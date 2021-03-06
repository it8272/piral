import { isfunc, createEmptyModule, getDependencyResolver } from './utils';
import { defaultFetchDependency } from './fetch';
import { compileDependency, includeDependency } from './dependency';
import {
  PiletMetadata,
  Pilet,
  PiletDependencyGetter,
  PiletRequester,
  PiletDependencyFetcher,
  AvailableDependencies,
  PiletApp,
} from './types';

const inBrowser = typeof document !== 'undefined';

function loadFrom(
  meta: PiletMetadata,
  getDependencies: PiletDependencyGetter,
  loader: (dependencies: AvailableDependencies) => Promise<PiletApp>,
): Promise<Pilet> {
  const dependencies = {
    ...(getDependencies(meta) || {}),
  };
  return loader(dependencies).then(app => ({
    ...app,
    ...meta,
  }));
}

function checkFetchPilets(fetchPilets: PiletRequester) {
  if (!isfunc(fetchPilets)) {
    console.error('Could not get the pilets. Provide a valid `fetchPilets` function.');
    return false;
  }

  return true;
}

/**
 * Loads the given raw pilet content by resolving its dependencies and
 * evaluating the content.
 * @param meta The raw pilet content as received from the server.
 * @param fetchDependency The function to resolve a dependency.
 * @param dependencies The already evaluated global dependencies.
 * @returns A promise leading to the pilet content which has the metadata and a `setup` function.
 */
export function loadPilet(
  meta: PiletMetadata,
  getDependencies: PiletDependencyGetter,
  fetchDependency = defaultFetchDependency,
): Promise<Pilet> {
  if (inBrowser && 'requireRef' in meta) {
    return loadFrom(meta, getDependencies, deps => includeDependency(meta, deps));
  }

  const { name, link } = meta;

  if (link) {
    return fetchDependency(link).then(content =>
      loadFrom(meta, getDependencies, deps => compileDependency(name, content, link, deps)),
    );
  } else if ('content' in meta && meta.content) {
    return loadFrom(meta, getDependencies, deps => compileDependency(name, meta.content, link, deps));
  } else {
    console.warn('Empty pilet found!', name);
  }

  return Promise.resolve(createEmptyModule(meta));
}

/**
 * Loads the pilets metadata and puts them in the cache, if provided.
 * @param fetchPilets The function to resolve the pilets.
 * @param cache The optional cache to use initially and update later.
 */
export function loadMetadata(fetchPilets: PiletRequester) {
  if (checkFetchPilets(fetchPilets)) {
    return fetchPilets();
  }

  return Promise.resolve([]);
}

/**
 * Loads the pilets by first getting them, then evaluating the raw content.
 * @param fetchPilets The function to resolve the pilets.
 * @param fetchDependency A function to fetch the dependencies. By default, `fetch` is used.
 * @param dependencies The availablly global dependencies, if any.
 * @returns A promise leading to the evaluated pilets.
 */
export function loadPilets(
  fetchPilets: PiletRequester,
  fetchDependency?: PiletDependencyFetcher,
  globalDependencies?: AvailableDependencies,
  getLocalDependencies?: PiletDependencyGetter,
): Promise<Array<Pilet>> {
  const getDependencies = getDependencyResolver(globalDependencies, getLocalDependencies);

  return loadMetadata(fetchPilets).then(pilets =>
    Promise.all(pilets.map(m => loadPilet(m, getDependencies, fetchDependency))),
  );
}
