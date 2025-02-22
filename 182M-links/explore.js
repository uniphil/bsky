
const bucket_names = [ 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10', 'b12', 'b16', 'b32', 'b64', 'b128', 'b256', 'b512', 'b1024', 'b4096', 'b16384', 'b65535', 'b262144', 'bmax' ];
const bucket_sizes = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16, 32, 64, 128, 256, 512, 1024, 4096, 16384, 65535, 262144, Infinity ];

const data = await d3.csv('./182M-link-buckets.csv');

let bucketed = data.map(link_stats => {
  const { collection, link_path, link_type, linking_record_sample } = link_stats;
  const buckets = bucket_names.map(bname => parseInt(link_stats[bname], 10));
  return { collection, link_path, link_type, linking_record_sample, buckets };
});

console.log(bucketed);

const bucket_merge = (buckets_init, buckets_to_merge) =>
  (buckets_init || Array.from({ length: bucket_names.length }).map(_ => 0))
    .map((init, i) => init + buckets_to_merge[i]);

const bucket_total_bounds = buckets =>
  buckets.reduce((a, b, i) => {
    a.lower += i == 0 ? 0 : b * (bucket_sizes[i - 1] + 1);
    if (i == bucket_sizes.length - 1) {
      a.upper += b * 1048576;
      if (b > 0) {
        a.upper_inf = true;
      }
    } else {
      a.upper += b * bucket_sizes[i];
    }
    return a;
  }, { lower: 0, upper: 0, upper_inf: false });

const merge_link_buckets = links =>
  links.reduce((a, b) => bucket_merge(a, b.buckets), null)

const merged = merge_link_buckets(bucketed);
console.log(bucket_total_bounds(merged), merged);

// Declare the chart dimensions and margins.
const width = 640;
const height = 400;
const marginTop = 20;
const marginRight = 20;
const marginBottom = 30;
const marginLeft = 40;

// Declare the x (horizontal position) scale.
const x = d3.scaleUtc()
    .domain([new Date("2023-01-01"), new Date("2024-01-01")])
    .range([marginLeft, width - marginRight]);

// Declare the y (vertical position) scale.
const y = d3.scaleLinear()
    .domain([0, 100])
    .range([height - marginBottom, marginTop]);

// Create the SVG container.
const svg = d3.create("svg")
    .attr("width", width)
    .attr("height", height);

// Add the x-axis.
svg.append("g")
    .attr("transform", `translate(0,${height - marginBottom})`)
    .call(d3.axisBottom(x));

// Add the y-axis.
svg.append("g")
    .attr("transform", `translate(${marginLeft},0)`)
    .call(d3.axisLeft(y));

// Append the SVG element.
container.append(svg.node());
