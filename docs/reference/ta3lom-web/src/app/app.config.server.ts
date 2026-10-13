import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { PRERENDER_HTTP_CACHE } from './core/prerender-http-cache';
import { createPrerenderHttpCache } from './core/prerender-http-cache.server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // Created once, at module load: one cache per prerender worker, shared by every route it renders.
    { provide: PRERENDER_HTTP_CACHE, useValue: createPrerenderHttpCache() },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
