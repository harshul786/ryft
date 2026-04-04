import type { ModelOption } from '../types.ts';

export interface ProviderTarget {
  name: string;
  baseUrl: string;
  apiKey?: string;
}

export interface RoutePlan {
  model: string;
  target: ProviderTarget;
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, '');
}

export function resolveRouteForModel(
  modelName: string,
  models: ModelOption[],
  targets: Record<string, ProviderTarget>,
  fallbackProvider = 'OpenAI',
): RoutePlan {
  const found =
    models.find(model => {
      const normalized = modelName.toLowerCase();
      const candidates = [
        model.id,
        model.label,
        `${model.provider}/${model.id}`,
        ...(model.aliases ?? []),
      ].map(candidate => candidate.toLowerCase());
      return candidates.includes(normalized);
    }) ?? models.find(model => model.provider === fallbackProvider) ?? models[0];

  if (!found) {
    const target = targets.default ?? Object.values(targets)[0];
    if (!target) {
      throw new Error('No upstream targets are configured for the Ryft proxy.');
    }
    return { model: modelName, target };
  }

  const target =
    (found.baseUrl && Object.values(targets).find(t => normalizeBaseUrl(t.baseUrl) === normalizeBaseUrl(found.baseUrl!))) ??
    targets[found.provider] ??
    targets.default ??
    Object.values(targets)[0];

  if (!target) {
    throw new Error(`No upstream target found for model ${found.id}.`);
  }

  return { model: found.id, target };
}

export function buildRequestBody(payload: unknown, route: RoutePlan): string {
  if (!payload || typeof payload !== 'object') {
    return JSON.stringify(payload);
  }

  const request = payload as Record<string, unknown>;
  return JSON.stringify({
    ...request,
    model: route.model,
  });
}
