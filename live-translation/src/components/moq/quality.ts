import type { MoqQualityPreference } from './types';

const MOQ_QUALITY_PREFERENCE_STORAGE_KEY = 'moqQualityPreference';

const MOQ_QUALITY_PREFERENCES: MoqQualityPreference[] = ['auto', 'minimum', 'maximum'];

type RenditionConfig = {
  codedWidth?: number;
  codedHeight?: number;
  bitrate?: number;
};

type RenderedSize = {
  width?: number | string;
  height?: number | string;
};

const parseMoqQualityPreference = (value: string | null): MoqQualityPreference =>
  MOQ_QUALITY_PREFERENCES.includes(value as MoqQualityPreference) ? (value as MoqQualityPreference) : 'auto';

export const getPersistedMoqQualityPreference = () =>
  parseMoqQualityPreference(localStorage.getItem(MOQ_QUALITY_PREFERENCE_STORAGE_KEY));

export const formatRenditionLabel = (rendition?: string) => {
  if (!rendition) {
    return 'Auto';
  }

  if (rendition.endsWith('/hd')) {
    return 'High';
  }

  if (rendition.endsWith('/sd')) {
    return 'Low';
  }

  return rendition.split('/').at(-1) ?? rendition;
};

const getRenditionPixels = (config?: RenditionConfig) => {
  const pixels = (config?.codedWidth ?? 0) * (config?.codedHeight ?? 0);

  return pixels > 0 ? pixels : 0;
};

const compareRenditions = (
  left: [string, RenditionConfig],
  right: [string, RenditionConfig],
  direction: 'ascending' | 'descending',
) => {
  const leftPixels = getRenditionPixels(left[1]);
  const rightPixels = getRenditionPixels(right[1]);
  const multiplier = direction === 'ascending' ? 1 : -1;

  if (leftPixels !== rightPixels) {
    return (leftPixels - rightPixels) * multiplier;
  }

  return ((left[1].bitrate ?? 0) - (right[1].bitrate ?? 0)) * multiplier;
};

export const getSortedRenditionNames = (
  available: Record<string, RenditionConfig>,
  direction: 'ascending' | 'descending' = 'ascending',
) =>
  Object.entries(available)
    .sort((left, right) => compareRenditions(left, right, direction))
    .map(([name]) => name);

const getRenderedPixels = (size?: RenderedSize) => {
  const width = typeof size?.width === 'number' ? size.width : 0;
  const height = typeof size?.height === 'number' ? size.height : 0;
  const pixels = width * height;

  return pixels > 0 ? pixels : undefined;
};

export const selectRenditionName = (
  available: Record<string, RenditionConfig>,
  preference: MoqQualityPreference,
  renderedSize?: RenderedSize,
) => {
  const renditions = Object.entries(available);

  if (renditions.length === 0) {
    return undefined;
  }

  if (preference === 'minimum') {
    return getSortedRenditionNames(available, 'ascending')[0];
  }

  if (preference === 'maximum') {
    return getSortedRenditionNames(available, 'descending')[0];
  }

  const renderedPixels = getRenderedPixels(renderedSize);

  if (!renderedPixels) {
    return getSortedRenditionNames(available, 'descending')[0];
  }

  return renditions
    .map(([name, config]) => ({
      name,
      distance: Math.abs(getRenditionPixels(config) - renderedPixels),
      pixels: getRenditionPixels(config),
      bitrate: config.bitrate ?? 0,
    }))
    .sort((left, right) => {
      if (left.distance !== right.distance) {
        return left.distance - right.distance;
      }

      if (left.pixels !== right.pixels) {
        return left.pixels - right.pixels;
      }

      return left.bitrate - right.bitrate;
    })[0]?.name;
};

export const selectManualOverrideRendition = (available: Record<string, RenditionConfig>, manualRendition: string) => {
  if (manualRendition in available) {
    return manualRendition;
  }

  if (manualRendition.endsWith('/low')) {
    return selectRenditionName(available, 'minimum');
  }

  if (manualRendition.endsWith('/hd')) {
    return selectRenditionName(available, 'maximum');
  }

  if (manualRendition.endsWith('/sd')) {
    return selectRenditionName(available, 'minimum');
  }

  return selectRenditionName(available, 'auto');
};
