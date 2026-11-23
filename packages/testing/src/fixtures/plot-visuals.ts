export const DETECTOR_SCAN_PLOT = {
  kind: "plot" as const,
  references: [],
  series: [
    {
      mark: "points" as const,
      name: "Scan",
      points: [
        { label: "A", x: 0.5, y: 810 },
        { label: "B", x: 1.5, y: 880 },
        { label: "C", x: 3, y: 952 },
        { label: "D", x: 4.5, y: 890 },
        { label: "E", x: 5.5, y: 820 },
      ],
    },
  ],
  source: null,
  title: "Detector scan",
  xLabel: "Detector position",
  xUnit: "mm",
  yLabel: "Count rate",
  yUnit: "counts/s",
};

export const FILL_WEIGHT_PLOT = {
  kind: "plot" as const,
  references: [
    { label: "Upper limit", y: 503 },
    { label: "Target", y: 500 },
    { label: "Lower limit", y: 497 },
  ],
  series: [
    {
      mark: "lineWithPoints" as const,
      name: "Fill weight",
      points: [
        { label: null, x: 1, y: 499.8 },
        { label: null, x: 2, y: 500.6 },
        { label: null, x: 3, y: 499.3 },
        { label: null, x: 4, y: 501 },
        { label: null, x: 5, y: 500.4 },
        { label: null, x: 6, y: 501.6 },
        { label: null, x: 7, y: 502.3 },
        { label: null, x: 8, y: 503.8 },
        { label: null, x: 9, y: 502.9 },
        { label: null, x: 10, y: 502.1 },
      ],
    },
  ],
  source: null,
  title: "Bottle fill weight, last 10 days",
  xLabel: "Day",
  xUnit: null,
  yLabel: "Fill weight",
  yUnit: "ml",
};

export const FINE_SCAN_PLOT = {
  kind: "plot" as const,
  references: [{ label: "Needed tonight", y: 960 }],
  series: [
    {
      mark: "lineWithPoints" as const,
      name: "Fine scan",
      points: [
        { label: null, x: 1.5, y: 880 },
        { label: null, x: 2, y: 930 },
        { label: null, x: 2.25, y: 968 },
        { label: null, x: 2.5, y: 992 },
        { label: null, x: 2.75, y: 975 },
        { label: null, x: 3, y: 952 },
        { label: null, x: 3.25, y: 925 },
        { label: null, x: 3.5, y: 905 },
        { label: null, x: 4, y: 893 },
        { label: null, x: 4.5, y: 890 },
      ],
    },
  ],
  source: null,
  title: "Finer scan, B to D",
  xLabel: "Detector position",
  xUnit: "mm",
  yLabel: "Count rate",
  yUnit: "counts/s",
};
