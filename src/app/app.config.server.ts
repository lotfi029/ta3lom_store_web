import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { PRERENDER_HTTP_CACHE } from './core/http/prerender-http-cache';
import { createPrerenderHttpCache } from './core/http/prerender-http-cache.server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // One cache per prerender worker: a URL every page needs is fetched once per worker, not once per page.
    { provide: PRERENDER_HTTP_CACHE, useValue: createPrerenderHttpCache() },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
