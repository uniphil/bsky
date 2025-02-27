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

// hack: pull the source collection into the sample
data.forEach(d => d.buckets.forEach(b => {
  if (b.sample) b.sample.collection = d.collection;
}));

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
  let width = 240,
      height = 72,
      bucketing = null,
      y_log = true,
      bucketing_value = 'sum';
  const pad_top = 6;
  const pad_bottom = 20;
  const pad_left = 36;
  const pad_right = 16;

  function chart(selection) {
    if (!bucketing) { throw new Error('must specify bucketing to render histogram'); }
    selection.each(function(buckets) {
      let svg = d3.select(this).selectAll('svg').data([buckets]);
      const g_enter = svg.enter().append('svg').append('g').attr('class', 'drawable');
      g_enter.append('g').attr('class', 'bars');
      g_enter.append('g').attr('class', 'x axis');
      g_enter.append('g').attr('class', 'y axis');
      svg = d3.select(this).selectAll('svg');

      const x = bucketing.log
        ? d3.scaleLog([bucketing.x0, bucketing.x_max], [0, width - pad_left - pad_right]).base(16)
        : d3.scaleLinear([bucketing.x0, bucketing.x_max], [0, width - pad_left - pad_right]);
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
        .call(bucketing.log
          ? d3.axisBottom(x).ticks(5, '.3s')
          : d3.axisBottom(x));

      svg.select('.y.axis')
        .call(d3.axisLeft(y).ticks(4, '~s'));

      // update bars
      svg.select('.bars')
        .selectAll('rect')
        .data(buckets)
        .join('rect')
          .filter(d => d[bucketing_value] > 0)
          .attr('x', 0)
          .attr('transform', (d, i) => `translate(${i == 0 ? 0 : x(d.lower)}, ${y(d[bucketing_value])})`)
          .attr('width', (d, i) => (i == 0 ? x(1) : (x(Math.min(bucketing.x_max, d.upper)) - x(d.lower))) - 0.5)
          .attr('height', d => height - pad_top - pad_bottom - y(d[bucketing_value]))
          .style('fill', '#f90')
          .classed('sample linked', d => !!d.sample)
          .on('click', (_, d) => !!d.sample && open_sample(d.sample));
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


const group_by = grouper => links => {
  const by_group = {};
  links.forEach(buckets => {
    const group = grouper(buckets);
    if (!by_group[group]) {
      by_group[group] = [];
    }
    by_group[group].push(buckets);
  });
  return Object.keys(by_group).map(group =>
    ({ group, links: by_group[group] }));
};

const group_by_link_type = group_by(buckets => buckets.link_type);

const collapse_buckets = buckets =>
  buckets.reduce((a, b) => {
    a.count += b.count;
    a.sum += b.sum;
    a.sample ||= b.sample;
    return a;
  }, { count: 0, sum: 0, sample: null });



const apply_filters = (filters, data) => {
  let filtered = data;
  filters.forEach(({ group, grouper }) => {
    filtered = filtered.filter(buckets => grouper.group(buckets) === group);
  });
  return filtered;
};



function link_types_hbar() {
  const height = 64;
  const width = 192;
  const pad_left = 36;
  const pad_right = 36;
  const pad_bottom = 16;
  const bar_gap = 1;

  let log_scale = false;
  let showing_value = 'sum';
  let on_set_filter = () => null;

  let filter_options = new Set();
  let filter = new Set();

  const filter_none_if_all = () => {
    if (filter.size === filter_options.size) {
      filter = new Set();
    }
  };

  const toggle_filter = f => {
    if (!filter_options.has(f)) { throw new Error(`tried to toggle filter that was not an option: ${f}`); }
    if (filter.has(f)) {
      filter.delete(f);
      on_set_filter(filter);
    } else {
      filter.add(f);
      filter_none_if_all();
      on_set_filter(filter);
    }
  };

  const set_filter_options = opts => {
    filter_options = new Set(opts);
    const filter_before_size = filter.size;
    filter = filter.intersection(filter_options);
    filter_none_if_all();
    if (filter.size !== filter_before_size) {
      on_set_filter(filter);
    }
  };

  function chart(selection) {
    selection.each(function(d) {

      const summarized = group_by_link_type(d)
        .map(({ group, links }) => Object.assign(
          { group },
          collapse_buckets(merge(links))));

      set_filter_options(summarized.map(s => s.group));

      summarized.sort((a, b) => a.group.localeCompare(b.group));

      let svg = d3.select(this).selectAll('svg').data([summarized]);
      const g_enter = svg.enter().append('svg').append('g').attr('class', 'drawable');
      g_enter.append('g').attr('class', 'bars');
      g_enter.append('g').attr('class', 'x axis');
      svg = d3.select(this).selectAll('svg');

      const x_max = Math.max.apply(null, summarized.map(t => t[showing_value]));
      const x = log_scale
        ? d3.scaleLog([1, x_max], [0, width - pad_left - pad_right])
        : d3.scaleLinear([0, x_max], [0, width - pad_left - pad_right]);

      // update height/width
      svg.attr('width', width).attr('height', height);

      // update drawable group
      svg.select('.drawable')
        .attr('transform', `translate(${pad_left}, 0)`);

      // update axes
      svg.select('.x.axis')
        .attr('transform', `translate(0, ${height - pad_bottom})`)
        .call(d3.axisBottom(x).ticks(3, '~s'));

      const bar_interval = (height - pad_bottom) / summarized.length;

      const fill_bar = d => d.include ? '#f90' : '#ccc';

      const enter_bar = enter => {
        const g = enter.append('g').attr('class', 'bar');
        g.append('rect')
          .attr('x', 0)
          .attr('height', bar_interval - bar_gap)
          .style('fill', fill_bar)
          .attr('width', d => x(d[showing_value]))
          .on('click', (_, d) => toggle_filter(d.group));
        g.append('text')
          .text(d => d.group)
          .style('font-size', '13px')
          .attr('y', bar_interval - bar_gap - (bar_interval - bar_gap - 13)/2 - 2)
          .attr('x', -2)
          .attr('text-anchor', 'end');
        g.append('text')
          .attr('class', 'n')
          .text(d => d3.format(',.2s')(d[showing_value]))
          .style('font-size', '13px')
          .attr('y', bar_interval - bar_gap - (bar_interval - bar_gap - 13)/2 - 2)
          .attr('x', d => x(d[showing_value]));
        return g;
      };

      const update_bar = update => {
        update
          .select('rect')
          .attr('width', d => x(d[showing_value]))
          .style('fill', fill_bar);
        update
          .select('.n')
          .text(d => d3.format(',.2s')(d[showing_value]))
          .attr('x', d => x(d[showing_value]))
        return update;
      };

      // update bars
      svg.select('.bars')
        .selectAll('.bar')
        .data(summarized.map(s => Object.assign(s, {include: filter.has(s.group) || filter.size === 0 })))
        .join(enter_bar, update_bar)
          .attr('transform', (_d, i) => `translate(0, ${i * bar_interval + bar_gap})`)

    });
  }

  chart.showing_value = _ => {
    if (arguments.length) return showing_value;
    showing_value = _;
    return chart;
  };

  chart.log_scale = _ => {
    if (arguments.length) return log_scale;
    log_scale = _;
    return chart;
  };

  chart.on_set_filter = _ => {
    if (arguments.length) return on_set_filter;
    on_set_filter = _;
    return chart;
  }

  return chart;
}


const totals = buckets =>
  buckets.reduce((a, b) => {
    a.count += b.count;
    a.sum += b.sum;
    a.sample ||= b.sample;
    return a;
  }, { count: 0, sum: 0, sample: null });


const commas = d3.format(',');

function buckets_info() {
  let bucketing = null;
  let bucketing_value = null;
  function info(selection) {
    if (!bucketing || !bucketing_value) { throw new Error('must set bucketing and bucketing_value'); }
    selection.each(function(d) {
      let info = d3.select(this).selectAll('.buckets-info').data([d]);
      let info_enter = info.enter().append('div').attr('class', 'buckets-info');
      info_enter.append('div').attr('class', 'totals');
      info_enter.append('div').attr('class', 'info-histo');
      info = d3.select(this).selectAll('.buckets-info');

      const merged = merge(d);
      const t = totals(merged);

      info.selectAll('.totals')
        .html(`links: <code>${commas(t.sum)}</code><br/>targets: <code>${commas(t.count)}</code>`);

      info.selectAll('.info-histo')
        .datum(bucket(merged, bucketing.group))
        .call(hist()
          .bucketing(bucketing)
          .bucketing_value(bucketing_value.bucket_prop)
          .y_log(bucketing_y_log));
    });
  }
  info.bucketing = _ => {
    if (arguments.length) return bucketing;
    bucketing = _;
    return info;
  }
  info.bucketing_value = _ => {
    if (arguments.length) return bucketing_value;
    bucketing_value = _;
    return info;
  }
  return info;
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


const filter_links = (links, f) => links.filter(f);


function primary_info() {
  let grouper = null;
  let bucketing = null;
  let bucketing_value = null;
  let on_add_filter = null;

  function info(selection) {
    if (!grouper) { throw new Error('must set grouper'); }
    selection.each(function(links) {
      var primary = d3.select(this).selectAll('.primary-info').data([links])
      const primary_enter = primary.enter().append('div').attr('class', 'primary-info');
      primary_enter.append('div').attr('class', 'primary-info-groups-list');
      primary = d3.select(this).selectAll('.primary-info');

      const sort_by = bucketing_value.bucket_prop;

      // data mangling
      const with_totals = links
        .map(({ group, links }) =>
          ({ group, links, totals: totals(merge(links)) }));

      with_totals.sort((a, b) => b.totals[sort_by] - a.totals[sort_by]);

      const enter_group = enter => {
        const div = enter.append('div').attr('class', 'primary-group');
        const controls = div.append('div').attr('class', 'primary-group-controls');
        controls.append('h4').text(d => d.group);
        controls.append('button')
          .on('click', (_, { group }) => on_add_filter({ grouper, group }))
          .text('+ filter');

        return div;
      };

      const update_group = update => {
        update.select('h4').text(d => d.group);
        return update;
      };

      // goooooo
      primary
        .select('.primary-info-groups-list')
        .selectAll('.primary-group')
        .data(with_totals, d => d.group)
        .join(enter_group, update_group)
          .selectAll('.primary-group-buckets-info')
          .data(d => [d.links])
          .join('div')
          .attr('class', 'primary-group-buckets-info')
          .call(buckets_info()
            .bucketing(bucketing)
            .bucketing_value(bucketing_value));

    });
  }
  info.grouper = _ => {
    if (arguments.length) return grouper;
    grouper = _;
    return info;
  };
  info.bucketing = _ => {
    if (arguments.length) return bucketing;
    bucketing = _;
    return info;
  };
  info.bucketing_value = _ => {
    if (arguments.length) return bucketing_value;
    bucketing_value = _;
    return info;
  };
  info.on_add_filter = _ => {
    if (arguments.length) return on_add_filter;
    on_add_filter = _;
    return info;
  };
  return info;
}


function active_filter_indicator() {
  let on_remove_filter;
  function indicator(selection) {
    selection.each(function(d) {
      let div = d3.select(this).selectAll('.active-filter-indicators').data([[1, 2, 3]]);
      const div_enter = div.enter().append('div').attr('class', 'active-filter-indicators');
      div = d3.select(this).selectAll('.active-filter-indicators');

      div
        .selectAll('button')
        .data(d)
        .join('button')
          .on('click', (_, f) => on_remove_filter(f))
          .html(({ grouper, group }) => `${grouper.label}: <code>${group}</code> &times;`);
    });
  }
  indicator.on_remove_filter = _ => {
    if (arguments.length) return on_remove_filter;
    on_remove_filter = _;
    return indicator;
  };
  return indicator;
}



/////////////////  STATE  ///////////////


const pds_browser_opts = [
  { label: '<code>PDSls</code>', checked: true,
    to_url: s => `https://pdsls.dev/at://${s.did}/${s.collection}/${s.rkey}` },
  { label: '@tools',
    to_url: s => `https://atp.tools/at:/${s.did}/${s.collection}/${s.rkey}` },
  { label: 'atproto browser',
    to_url: s => `https://atproto-browser.vercel.app/at/${s.did}/${s.collection}/${s.rkey}` },
];
let current_pds_browser = pds_browser_opts[0];
const pds_browser_buttons = button_group()
  .input_name('histogram-bucketing')
  .on_input(change_to => {
    pds_browser_opts.forEach(o => o.checked = false);
    change_to.checked = true;
    current_pds_browser = change_to;
    render();
  });
const open_sample = s => {
  const url = current_pds_browser.to_url(s);
  window.open(url, '_blank').focus();
};


const bucketing_opts = [
  { label: '2<sup>n</sup>', group: buckets_2_n, x0: 0.5, log: true, x_max: 1048576 },
  { label: '4<sup>n</sup>', group: buckets_4_n, x0: 0.25, log: true, x_max: 1048576, checked: true },
  { label: '1–10+', group: buckets_10, x0: 0, log: false, x_max: 10 },
  { label: 'all', group: buckets_all, x0: 0.4, log: true, x_max: 1048576 },
];
let current_bucketing = bucketing_opts[1];
const hist_bucketing_buttons = button_group()
  .input_name('histogram-bucketing')
  .on_input(change_to => {
    bucketing_opts.forEach(o => o.checked = false);
    change_to.checked = true;
    current_bucketing = change_to;
    render();
  });


const bucketing_value_opts = [
  { label: 'count', bucket_prop: 'count' },
  { label: 'sum', bucket_prop: 'sum', checked: true },
];
let current_bucketing_value = bucketing_value_opts[1];
const hist_value_buttons = button_group()
  .input_name('histogram-value')
  .on_input(change_to => {
    bucketing_value_opts.forEach(o => o.checked = false);
    change_to.checked = true;
    current_bucketing_value = change_to;
    render();
  });

let bucketing_y_log = false;



let filters = [];
const add_filter = filter => {
  filters.push(filter);
  render();
};
const rm_filter = filter => {
  filters = filters.filter(f => f !== filter);
  render();
}



let link_type_filter = new Set();
const link_type_filter_thing = link_types_hbar().on_set_filter(f => {
  link_type_filter = f;
  render();
});
const get_link_type_filter = f => buckets =>
  f.size === 0 || f.has(buckets.link_type);


const primary_grouper_opts = [
  {
    label: 'collection prefix',
    group: buckets => buckets.collection.split('.').slice(0, 2).join('.'),
    checked: true,
  },
  {
    label: 'collection',
    group: buckets => buckets.collection,
  },
  {
    label: 'path suffix',
    group: buckets => buckets.path.split('.').slice(-2).join('.'), // this is quite bad
  },
  {
    label: 'path',
    group: buckets => buckets.path,
  },
  {
    label: 'target collection',
    group: buckets => buckets.target_collection,
  },
];
let primary_grouper = primary_grouper_opts[0];
const primary_grouper_buttons = button_group()
  .input_name('primary-grouper')
  .on_input(change_to => {
    primary_grouper_opts.forEach(o => o.checked = false);
    change_to.checked = true;
    primary_grouper = change_to;
    render();
  });


//////////////  DOM SETUP  ////////////

const container = d3.select('body');
const top_controls = container.append('div').attr('class', 'top-controls');

top_controls
  .append('h1')
  .text('1.2 billion links');

const pds_browser_control = top_controls
  .append('div')
  .attr('class', 'pds-browser-controls');
pds_browser_control.append('p').html('open samples in<br/>PDS browser:');


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


const active_filters = container
  .append('div')
  .attr('class', 'active-filters');
active_filters.append('p').text('filtering: ');


const supersummary = container
  .append('div')
  .attr('class', 'super-summary');

const summary = supersummary
  .append('div')
  .attr('class', 'summary');

const link_types = supersummary
  .append('div')
  .attr('class', 'link-types');


const primary_grouping = container
  .append('div')
  .attr('class', 'primary-grouping-buttons');
primary_grouping.append('p').text('by: ');



const primary_groups = container
  .append('div')
  .attr('class', 'primary-groups-blah');



///// ///// /////  renderrrrrr  ///// ///// /////

function render() {
  pds_browser_control
    .datum(pds_browser_opts)
    .call(pds_browser_buttons);

  histogram_bucketing
    .datum(bucketing_opts)
    .call(hist_bucketing_buttons);

  histogram_value
    .datum(bucketing_value_opts)
    .call(hist_value_buttons);


  const filtered_data = apply_filters(filters, data);


  link_types
    .datum(filtered_data)
    .call(link_type_filter_thing
      .showing_value(current_bucketing_value.bucket_prop)
      .log_scale(bucketing_y_log));

  active_filters
    .datum(filters)
    .call(active_filter_indicator()
      .on_remove_filter(rm_filter));

  const link_type_filtered = filter_links(filtered_data, get_link_type_filter(link_type_filter));

  summary
    .datum(link_type_filtered)
    .call(buckets_info()
      .bucketing(current_bucketing)
      .bucketing_value(current_bucketing_value));

  primary_grouping
    .datum(primary_grouper_opts)
    .call(primary_grouper_buttons);

  const links_by_primary_grouping = group_by(primary_grouper.group)(link_type_filtered);

  primary_groups
    .datum(links_by_primary_grouping)
    .call(primary_info()
      .grouper(primary_grouper)
      .bucketing(current_bucketing)
      .bucketing_value(current_bucketing_value)
      .on_add_filter(add_filter));
}
render();
