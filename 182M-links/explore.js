
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


const summary = (name, links, level) => {
  let merged_buckets = merge_link_buckets(bucketed);
  const bounds = bucket_total_bounds(merged_buckets);
  console.log(bounds);
  const title = `${name} (${bounds.lower.toLocaleString()} – ${bounds.upper_inf ? '>' : ''}${bounds.upper.toLocaleString()} total)`;
  const d = d3.create('div')
    .style('display', 'flex')
    .style('align-items', 'flex-center')
    .style('gap', '1em');
  d.append(`h${level || 1}`)
    .style('margin-bottom', '0')
    .text(title);
  d.append(() => mini_hist(merged_buckets));
  return d;
}

const mini_hist = buckets => {
  const width = 320;
  const height = 72;
  const pad_top = 6;
  const pad_bottom = 16;
  const pad_left = 36;
  const pad_right = 6;

  const svg = d3
    .create('svg')
      .attr('width', width)
      .attr('height', height);

  const drawable = svg
    .append('g')
      .attr('transform', `translate(${pad_left}, ${pad_top})`);

  const x = d3.scaleLog([.4, 1048576], [0, width - pad_left - pad_right])
  const y = d3.scaleLog([1, Math.max.apply(null, buckets)], [height - pad_top - pad_bottom, 0]);

  drawable.append('g')
    .attr('transform', `translate(0, ${height - pad_top - pad_bottom})`)
    .call(d3.axisBottom(x))

  drawable.append('g')
    .call(d3.axisLeft(y).ticks(4))

  drawable.selectAll('rect')
    .data(buckets)
    .enter()
    .append('rect')
      .attr('x', 0)
      .attr('transform', (d, i) => `translate(${i == 0 ? 0 : x(bucket_sizes[i-1])}, ${y(d)})`)
      .attr('width', (_, i) => (i == 0 ? x(1) : (x(bucket_sizes[i]) - x(bucket_sizes[i-1]))) - 1)
      .attr('height', d => height - pad_top - pad_bottom - y(d))
      .style('fill', '#69b3a2')

  return svg.node();
}


container.append(summary('all links', bucketed, 2).node());
