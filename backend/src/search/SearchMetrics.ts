type Labels = Record<string, string | number | boolean>;

const counters = new Map<string, number>();
const gauges = new Map<string, number>();
const durations = new Map<string, number[]>();
const histogramBuckets = [0.05, 0.1, 0.3, 0.5, 0.75, 0.8, 1, 2, 5];

const labelKey = (name: string, labels: Labels = {}): string => {
  const suffix = Object.entries(labels)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}="${String(value).replace(/["\\\n]/g, '_')}"`)
    .join(',');
  return suffix ? `${name}{${suffix}}` : name;
};

export class SearchMetrics {
  static increment(name: string, labels: Labels = {}, amount = 1): void {
    const key = labelKey(name, labels);
    counters.set(key, (counters.get(key) || 0) + amount);
  }

  static gauge(name: string, value: number, labels: Labels = {}): void {
    gauges.set(labelKey(name, labels), value);
  }

  static observe(name: string, valueMs: number, labels: Labels = {}): void {
    const key = labelKey(name, labels);
    const samples = durations.get(key) || [];
    samples.push(valueMs / 1000);
    if (samples.length > 5000) samples.splice(0, samples.length - 5000);
    durations.set(key, samples);
  }

  static render(): string {
    const lines: string[] = [];
    counters.forEach((value, key) => lines.push(`${key} ${value}`));
    gauges.forEach((value, key) => lines.push(`${key} ${value}`));
    durations.forEach((samples, key) => {
      const sum = samples.reduce((total, value) => total + value, 0);
      const labelStart = key.indexOf('{');
      const name = labelStart < 0 ? key : key.slice(0, labelStart);
      const labels = labelStart < 0 ? '' : key.slice(labelStart);
      const labelsBody = labels ? labels.slice(1, -1) : '';
      for (const bucket of histogramBuckets) {
        const bucketLabels = [labelsBody, `le="${bucket}"`].filter(Boolean).join(',');
        lines.push(`${name}_bucket{${bucketLabels}} ${samples.filter((value) => value <= bucket).length}`);
      }
      const infiniteLabels = [labelsBody, 'le="+Inf"'].filter(Boolean).join(',');
      lines.push(`${name}_bucket{${infiniteLabels}} ${samples.length}`);
      lines.push(`${name}_count${labels} ${samples.length}`, `${name}_sum${labels} ${sum}`);
    });
    return `${lines.join('\n')}\n`;
  }
}
