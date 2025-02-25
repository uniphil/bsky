"use strict";

// const bucket_names = [ 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10', 'b12', 'b16', 'b32', 'b64', 'b128', 'b256', 'b512', 'b1024', 'b4096', 'b16384', 'b65535', 'b262144', 'bmax' ];
const bucket_upper_bounds = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16, 32, 64, 128, 256, 512, 1024, 4096, 16384, 65535, 262144, Infinity ];
const buckets_all = bucket_upper_bounds.map(b => [b]);
const buckets_2_n = [
  [1],
  [2],
  [3, 4],
  [5, 6, 7, 8],
  [9, 10, 12, 16],
  [32],
  [64],
  [128],
  [256],
  [512],
  [1024],
  [4096],
  [16384],
  [65535],
  [262144],
  [Infinity],
];
const buckets_4_n = [
  [1],
  [2, 3, 4],
  [5, 6, 7, 8, 9, 10, 12, 16],
  [32, 64],
  [128, 256],
  [512, 1024],
  [4096],
  [16384],
  [65535],
  [262144],
  [Infinity],
];
const buckets_10 = [
  [1],
  [2],
  [3],
  [4],
  [5],
  [6],
  [7],
  [8],
  [9],
  [10, 12, 16, 32, 64, 128, 256, 512, 1024, 4096, 16384, 65535, 262144, Infinity],
];

const data = await d3.json('./1.1B.json');


function merge(link_stats) {
  const bucket_merge = (merged, to_merge) =>
    (merged || Array
      .from({ length: to_merge.buckets.length })
      .map(_ => ({ count: 0, sum: 0, sample: null }))
    )
      .map((m, i) => {
        const merger = to_merge.buckets[i];
        m.count += merger.count;
        m.sum += merger.sum;
        m.sample ||= merger.sample;
        return m;
      });
  return link_stats.reduce(bucket_merge, null)
}

function bucket(buckets, bucket_groups) {
  let out = [];
  let buckets_i = 0;
  bucket_groups.forEach((group, group_i) => {
    const b = {
      lower: group_i == 0 ? 0 : Math.max.apply(null, bucket_groups[group_i - 1]),
      upper: Math.max.apply(null, group),
      count: 0,
      sum: 0,
      sample: null,
    }
    group.forEach(_ => {
      const merger = buckets[buckets_i];
      b.count += merger.count;
      b.sum += merger.sum;
      b.sample ||= merger.sample;
      buckets_i += 1;
    });
    out.push(b);
  });
  return out;
}


function hist() {
  let width = 320,
      height = 72,
      bucketing = null,
      y_log = true,
      bucketing_value = 'count';
  const pad_top = 6;
  const pad_bottom = 16;
  const pad_left = 36;
  const pad_right = 6;

  function chart(selection) {
    if (!bucketing) { throw new Error('must specify bucketing to render histogram'); }
    selection.each(function(buckets) {
      let svg = d3.select(this).selectAll('svg').data([buckets]);
      const g_enter = svg.enter().append('svg').append('g').attr('class', 'drawable');
      g_enter.append('g').attr('class', 'bars');
      g_enter.append('g').attr('class', 'x axis');
      g_enter.append('g').attr('class', 'y axis');
      svg = d3.select(this).selectAll('svg');

      const x = (bucketing.log ? d3.scaleLog : d3.scaleLinear)([bucketing.x0, bucketing.x_max], [0, width - pad_left - pad_right])
      const y = y_log
        ? d3.scaleLog([1, Math.max.apply(null, buckets.map(b => b[bucketing_value]))], [height - pad_top - pad_bottom, 0])
        : d3.scaleLinear([0, Math.max.apply(null, buckets.map(b => b[bucketing_value]))], [height - pad_top - pad_bottom, 0]);

      // update height/width
      svg.attr('width', width).attr('height', height);

      // update drawable group
      svg.select('.drawable')
        .attr('transform', `translate(${pad_left}, ${pad_top})`);

      // update axes
      svg.select('.x.axis')
        .attr('transform', `translate(0, ${height - pad_top - pad_bottom})`)
        .call(d3.axisBottom(x));

      svg.select('.y.axis')
        .call(d3.axisLeft(y).ticks(4, "~s"));

      // update bars
      svg.select('.bars')
        .selectAll('rect')
        .data(buckets)
        .join('rect')
          .filter(d => d[bucketing_value] > 0)
          .attr('x', 0)
          .attr('transform', (d, i) => `translate(${i == 0 ? 0 : x(d.lower)}, ${y(d[bucketing_value])})`)
          .attr('width', (d, i) => (i == 0 ? x(1) : (x(Math.min(bucketing.x_max, d.upper)) - x(d.lower))) - 1)
          .attr('height', d => height - pad_top - pad_bottom - y(d[bucketing_value]))
          .style('fill', '#f90');
    });
  }
  chart.width = _ => {
    if (arguments.length) return width;
    width = _;
    return chart;
  };
  chart.height = _ => {
    if (arguments.length) return height;
    height = _;
    return chart;
  };
  chart.bucketing = _ => {
    if (arguments.length) return bucketing;
    bucketing = _;
    return chart;
  };
  chart.y_log = _ => {
    if (arguments.length) return y_log;
    y_log = _;
    return chart;
  };
  chart.bucketing_value = _ => {
    if (arguments.length) return bucketing_value;
    bucketing_value = _;
    return chart;
  };

  return chart;
}


function button_group() {
  let input_name = null,
      on_input = null;
  function group(selection) {
    if (!input_name) { throw new Error('must specify input_name for button_group'); }
    if (!on_input) { throw new Error('must specify on_input for button_group'); }
    selection.each(function(items) {
      let button_set = d3.select(this).selectAll('.button-set').data([items]);
      let set_enter = button_set.enter().append('div').attr('class', 'button-set');
      button_set = d3.select(this).selectAll('.button-set');
      const button_enter = button_set
        .selectAll('label')
        .data(items)
        .enter()
          .append('label')
          .attr('class', 'button-set-item');
      button_enter.append('input')
        .attr('type', 'radio')
        .attr('name', input_name)
        .attr('class', 'sr-only')
        .property('checked', d => d.checked)
        .on('input', (e, d) => on_input(d));
      button_enter.append('span')
        .html(d => d.label)

      button_set
        .selectAll('label')
        .classed('checked', d => d.checked)
        .selectAll('input')
        .property('checked', d => d.checked);
    });
  }
  group.input_name = _ => {
    if (arguments.length) return input_name;
    input_name = _;
    return group;
  }
  group.on_input = _ => {
    if (arguments.length) return on_input;
    on_input = _;
    return group;
  }
  return group;
}

////////


const bucketing_opts = [
  { label: '2<sup>n</sup>', group: buckets_2_n, x0: 0.5, log: true, x_max: 1048576 },
  { label: '4<sup>n</sup>', group: buckets_4_n, x0: 0.25, log: true, x_max: 1048576, checked: true },
  { label: '1–10+', group: buckets_10, x0: 0, log: false, x_max: 10 },
  { label: 'all', group: buckets_all, x0: 0.4, log: true, x_max: 1048576 },
]
let current_bucketing = bucketing_opts[1];
const hist_bucketing_buttons = button_group()
  .input_name('histogram-bucketing')
  .on_input(change_to => {
    bucketing_opts.forEach(o => o.checked = false);
    change_to.checked = true;
    current_bucketing = change_to;
    render();
  })


const bucketing_value_opts = [
  { label: 'count', bucket_prop: 'count', checked: true },
  { label: 'sum', bucket_prop: 'sum' },
];
let current_bucketing_value = bucketing_value_opts[0];
const hist_value_buttons = button_group()
  .input_name('histogram-value')
  .on_input(change_to => {
    bucketing_value_opts.forEach(o => o.checked = false);
    change_to.checked = true;
    current_bucketing_value = change_to;
    render();
  })




let bucketing_y_log = true;


///////

const container = d3.select('.data');
container
  .append('h1')
  .text('hello');


const histogram_controls = container.append('div').attr('class', 'histogram-controls');

const histogram_bucketing = histogram_controls
  .append('div')
  .attr('class', 'histogram-buttons');
histogram_bucketing.append('p').html('histogram<br/>buckets:');

const histogram_value = histogram_controls
  .append('div')
  .attr('class', 'histogram-buttons');
histogram_value.append('p').html('histogram<br/>value:');


const histogram_y_log = histogram_controls
  .append('label');
histogram_y_log
  .append('input')
  .attr('type', 'checkbox')
  .attr('class', 'y-log-scale')
  .property('checked', bucketing_y_log)
  .on('input', function() {
    bucketing_y_log = this.checked;
    render();
  });
histogram_y_log
  .append('span')
  .text('log scale');


const main_hist = container
  .append('div')
  .attr('class', 'hist');


////

function render() {
  histogram_bucketing
    .datum(bucketing_opts)
    .call(hist_bucketing_buttons);

  histogram_value
    .datum(bucketing_value_opts)
    .call(hist_value_buttons);

  main_hist
    .datum(bucket(merge(data), current_bucketing.group))
    .call(hist()
      .bucketing(current_bucketing)
      .bucketing_value(current_bucketing_value.bucket_prop)
      .y_log(bucketing_y_log));
}
render();


// let bucketed = data.map(link_stats => {
//   const { collection, link_path, link_type, linking_record_sample } = link_stats;
//   const buckets = bucket_names.map(bname => parseInt(link_stats[bname], 10));
//   return { collection, link_path, link_type, linking_record_sample, buckets };
// });

// const bucket_merge = (buckets_init, buckets_to_merge) =>
//   (buckets_init || Array.from({ length: bucket_names.length }).map(_ => 0))
//     .map((init, i) => init + buckets_to_merge[i]);

// const bucket_total_bounds = buckets =>
//   buckets.reduce((a, b, i) => {
//     a.lower += i == 0 ? 0 : b * (bucket_sizes[i - 1] + 1);
//     if (i == bucket_sizes.length - 1) {
//       a.upper += b * 1048576;
//       if (b > 0) {
//         a.upper_inf = true;
//       }
//     } else {
//       a.upper += b * bucket_sizes[i];
//     }
//     return a;
//   }, { lower: 0, upper: 0, upper_inf: false });

// const merge_link_buckets = links =>
//   links.reduce((a, b) => bucket_merge(a, b.buckets), null)

// const merged = merge_link_buckets(bucketed);


// const summary = (name, links, level) => {
//   let merged_buckets = merge_link_buckets(links);
//   const bounds = bucket_total_bounds(merged_buckets);
//   const d = d3.create('div')
//     .style('display', 'flex')
//     .style('align-items', 'flex-center')
//     .style('gap', '1em');
//   d.append(() => mini_hist(merged_buckets));

//   const info = d.append('div');
//   info.append(`h${level || 1}`)
//     .style('margin', '0')
//     .text(name);

//   const bounds_txt = `backlinks: lower bound: ${bounds.lower.toLocaleString()}; upper: ${bounds.upper_inf ? '>' : ''}${bounds.upper.toLocaleString()}`;
//   info.append('p')
//     .style('margin', '0.5em 0')
//     .text(bounds_txt);

//   return d;
// }

// const by_collection_prefix = link =>
//   link.collection.split('.').slice(0, 2).join('.');

// const mini_hist = buckets => {
//   const width = 320;
//   const height = 72;
//   const pad_top = 6;
//   const pad_bottom = 16;
//   const pad_left = 36;
//   const pad_right = 6;

//   const svg = d3
//     .create('svg')
//       .attr('width', width)
//       .attr('height', height);

//   const drawable = svg
//     .append('g')
//       .attr('transform', `translate(${pad_left}, ${pad_top})`);

//   const x = d3.scaleLog([.4, 1048576], [0, width - pad_left - pad_right])
//   const y = d3.scaleLog([1, Math.max.apply(null, buckets)], [height - pad_top - pad_bottom, 0]);

//   drawable.append('g')
//     .attr('transform', `translate(0, ${height - pad_top - pad_bottom})`)
//     .call(d3.axisBottom(x));

//   drawable.append('g')
//     .call(d3.axisLeft(y).ticks(4));

//   drawable.selectAll('rect')
//     .data(buckets)
//     .enter()
//     .append('rect')
//       .filter(d => d > 0)
//       .attr('x', 0)
//       .attr('transform', (d, i) => `translate(${i == 0 ? 0 : x(bucket_sizes[i-1])}, ${y(d)})`)
//       .attr('width', (_, i) => (i == 0 ? x(1) : (x(bucket_sizes[i]) - x(bucket_sizes[i-1]))) - 1)
//       .attr('height', d => height - pad_top - pad_bottom - y(d))
//       .style('fill', '#f90');

//   return svg.node();
// }


// const breakdown = (desc, data, grouper, level) => {
//   const groups = {};
//   data.forEach(stat => {
//     const group_name = grouper(stat);
//     if (!groups[group_name]) {
//       groups[group_name] = [];
//     }
//     groups[group_name].push(stat);
//   });
//   const as_items = [];
//   Object.keys(groups).forEach(group_name => {
//     as_items.push({ group_name, buckets: groups[group_name] });
//   })
//   as_items.sort((a, b) => {
//     const a_bounds = bucket_total_bounds(merge_link_buckets(a.buckets));
//     const b_bounds = bucket_total_bounds(merge_link_buckets(b.buckets));
//     return (b_bounds.lower + b_bounds.upper) - (a_bounds.lower + a_bounds.upper);
//   });

//   const container = d3.create('div');

//   container.append(`h${level}`).text(desc);

//   container
//     .selectAll('div.group')
//     .data(as_items)
//     .enter()
//     .append('div')
//       .classed('group', true)
//       .append(({ group_name, buckets }) => summary(group_name, buckets, level+1).node());

//   return container;
// }


// container.append(summary('all links', bucketed, 2).node());

// container.append(breakdown('by nsid prefix', bucketed, by_collection_prefix, 3).node());
