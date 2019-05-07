import { readFile, readFileSync, outputFileSync, existsSync, remove } from 'fs-extra';
import { sep, resolve } from 'path';
import express, { Application } from 'express';
import template from 'art-template';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Config } from '@react-ssr/express';
import Html from './html';
import build from './build';

const ENGINE: string = 'jsx';

const isProd: boolean = process.env.NODE_ENV === 'production';
const cwd: string = process.cwd();

const getPagePath = (file: string, config: Config): string => {
  return file.split(sep + config.viewsDir + sep)[1];
};

const register = async (app: Application, config: Config): Promise<void> => {
  require('@babel/register')();

  const buildDir: string = config.buildDir as string;
  const viewsDir: string = config.viewsDir as string;

  if (!isProd) {
    await remove(buildDir);
  }

  app.engine(ENGINE, (file: string, options: any, cb: (err: any, content?: string) => void) => {
    readFile(file, async (err, content) => {
      if (err) return cb(err);

      // HACK: delete unnecessary server options
      const props: any = options;
      delete props.settings;
      delete props._locals;
      delete props.cache;

      let html: string = '<!DOCTYPE html>';
      const pagePath: string = getPagePath(file, config);
      const page: string = resolve(cwd, buildDir, viewsDir, pagePath);
      const cache: string = resolve(cwd, buildDir, viewsDir, pagePath.replace('.jsx', '.html'));

      if (isProd) {
        // TODO: throw error if not built
        return cb(null, readFileSync(cache).toString());
      }

      if (existsSync(cache)) {
        return cb(null, readFileSync(cache).toString());
      }

      try {
        await outputFileSync(page, template.render(content.toString(), props));
        await build(page, config, props);

        let Page = require(page);
        Page = Page.default || Page;

        html += renderToString(
          <Html script={pagePath.replace('.jsx', '.js')}>
            <Page {...props} />
          </Html>
        );

        await outputFileSync(cache, html);

        return cb(null, html);
      } catch (e) {
        return cb(e);
      }
    })
  });

  app.set('views', resolve(cwd, viewsDir));
  app.set('view engine', ENGINE);

  app.use(express.static(buildDir));
};

export default register;
