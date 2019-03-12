/**
 * @class
 * @classdesc Marks time segments of a {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement|HTMLMediaElement}
 * @author Abhishek Dutta <adutta@robots.ox.ac.uk>
 * @since 5 Mar. 2019
 * @fires _via_temporal_segmenter#segment_add
 * @fires _via_temporal_segmenter#segment_del
 * @fires _via_temporal_segmenter#segment_edit
 * @param {Element} container HTML container element like <div>
 * @param {HTMLMediaElement} media_element HTML video of audio
 */

'use strict';

function _via_temporal_segmenter(container, file, data, media_element) {
  this.c = container;
  this.file = file;
  this.d = data;
  this.m = media_element;

  this.groupby = false;
  this.groupby_aid = '';
  this.group = {};
  this.gid_list = [];
  this.selected_gindex = -1;
  this.selected_mindex = -1;
  this.edge_show_time = -1;

  this.DRAW_LINE_WIDTH = 2;
  this.EDGE_UPDATE_TIME_DELTA = 1/50;  // in sec
  this.TEMPORAL_SEG_MOVE_OFFSET = 1;   // in sec
  this.DEFAULT_TEMPORAL_SEG_LEN = 1;   // in sec
  this.GTIMELINE_HEIGHT = 5;           // units of char width
  this.WIDTH_PER_SEC = 6;              // units of char width
  this.GID_COL_WIDTH = 15;             // units of char width
  this.METADATA_CONTAINER_HEIGHT = 22;  // units of char width
  this.METADATA_EDGE_TOL = 0.1;

  this.PLAYBACK_MODE = { NORMAL:'1', REVIEW_SEGMENT:'2', REVIEW_GAP:'3' };
  this.current_playback_mode = this.PLAYBACK_MODE.NORMAL;

  this.metadata_move_is_ongoing = false;
  this.metadata_resize_is_ongoing = false;
  this.metadata_resize_edge_index = -1;
  this.metadata_ongoing_update_x = [0, 0];
  this.metadata_move_start_x = 0;
  this.metadata_move_dx = 0;

  // registers on_event(), emit_event(), ... methods from
  // _via_event to let this module listen and emit events
  this._EVENT_ID_PREFIX = '_via_temporal_segmenter_';
  _via_event.call( this );

  if ( ! this.m instanceof HTMLMediaElement ) {
    throw 'media element must be an instance of HTMLMediaElement!';
  }

  // colour
  this.COLOR_LIST = ["#E69F00", "#56B4E9", "#009E73", "#0072B2", "#D55E00", "#CC79A7", "#F0E442"];
  this.NCOLOR = this.COLOR_LIST.length;

  this.current_playback_mode = this.PLAYBACK_MODE.NORMAL;

  this._init();
}

_via_temporal_segmenter.prototype._init = function() {
  try {
    this._group_init('0'); // for debug

    this._thumbview_init();
    this._vtimeline_init();
    this._tmetadata_init();
    this._toolbar_init();

    // trigger the update of animation frames
    this._redraw_all();
    this._redraw_timeline();
  } catch(err) {
    console.log(err);
  }
}

//
// All animation frame routines
//
_via_temporal_segmenter.prototype._redraw_all = function() {
  window.requestAnimationFrame(this._redraw_all.bind(this));
  var tnow = this.m.currentTime;
  this._update_playback_rate(tnow);

  if ( tnow < this.tmetadata_gtimeline_tstart ||
       tnow > this.tmetadata_gtimeline_tend
     ) {
    if ( ! this.m.paused ) {
      var new_tstart = Math.floor(tnow);
      this._tmetadata_boundary_update(new_tstart)
      this._tmetadata_gtimeline_draw();
    } else {
      //this.m.currentTime = this.tmetadata_gtimeline_tstart;
    }
  }

  // lock playback in the selected temporal segment
  if ( this.selected_mindex !== -1 ) {
    if ( ! this.m.paused ) {
      var t = this.d.metadata_store[this.selected_mid].z;
      if ( tnow > t[1] ) {
        this.m.currentTime = t[0];
      }
      if ( tnow < t[0] ) {
        this.m.currentTime = t[0];
      }
    }
  }

  this._redraw_timeline();

  // draw marker to show current time in group timeline and group metadata
  this._tmetadata_draw_currenttime_mark(tnow);
}

_via_temporal_segmenter.prototype._update_playback_rate = function(t) {
  //console.log(this.current_playback_mode + ':' + t)
  if ( this.current_playback_mode !== this.PLAYBACK_MODE.NORMAL ) {
    var mindex = this._tmetadata_group_gid_metadata_at_time(t);
    if ( mindex !== -1 ) {
      if ( this.current_playback_mode === this.PLAYBACK_MODE.REVIEW_SEGMENT ) {
        this._toolbar_playback_rate_set(1);
      } else {
        this._toolbar_playback_rate_set(10);
      }
    } else {
      if ( this.current_playback_mode === this.PLAYBACK_MODE.REVIEW_GAP ) {
        this._toolbar_playback_rate_set(1);
      } else {
        this._toolbar_playback_rate_set(10);
      }
    }
  } else {
    //this._toolbar_playback_rate_set(1);
  }
}

_via_temporal_segmenter.prototype._redraw_timeline = function() {
  // draw the full video timeline (on the top)
  this._vtimeline_mark_draw();
  // draw group timeline
  this._tmetadata_gtimeline_draw();
}

//
// thumbnail viewer
//
_via_temporal_segmenter.prototype._thumbview_init = function() {
  this.thumbnail_container = document.createElement('div');
  this.thumbnail_container.setAttribute('class', 'thumbnail_container');
  this.thumbnail_container.setAttribute('style', 'display:none; position:absolute; top:0; left:0;');
  this.c.appendChild(this.thumbnail_container);

  // initialise thumbnail viewer
  this.thumbnail = new _via_video_thumbnail(this.file);
  this.thumbnail.start();
}

_via_temporal_segmenter.prototype._thumbview_show = function(time, x, y) {
  this.thumbnail_container.innerHTML = '';
  this.thumbnail_container.appendChild(this.thumbnail.get_thumbnail(time));
  this.thumbnail_container.style.display = 'inline-block';

  this.thumbnail_container.style.left = x + this.linehn[2] + 'px';
  this.thumbnail_container.style.top  = y + this.linehn[4] + 'px';
}

_via_temporal_segmenter.prototype._thumbview_hide = function(t) {
  this.thumbnail_container.style.display = 'none';
}

//
// Full video timeline
//
_via_temporal_segmenter.prototype._vtimeline_init = function() {
  this.vtimeline = document.createElement('canvas');
  this.vtimeline.setAttribute('class', 'video_timeline');
  this.vtimeline.style.cursor = 'pointer';
  this.vtimeline.addEventListener('mousedown', this._vtimeline_on_mousedown.bind(this));
  this.vtimeline.addEventListener('mousemove', this._vtimeline_on_mousemove.bind(this));
  this.vtimeline.addEventListener('mouseout', this._vtimeline_on_mouseout.bind(this));

  var ctx = this.vtimeline.getContext('2d', {alpha:false});
  ctx.font = '10px Sans';
  this.char_width = ctx.measureText('M').width;
  this.vtimeline.width = this.c.clientWidth;
  this.vtimeline.height = Math.floor(2*this.char_width);
  this.padx = this.char_width;
  this.pady = this.char_width;
  this.lineh = Math.floor(this.char_width);
  this.linehn = []; // contains multiples of line_height for future ref.
  for ( var i = 0; i < 20; ++i ) {
    this.linehn[i] = i * this.lineh;
  }
  this.linehb2 = Math.floor(this.char_width/2);
  this.vtimelinew = Math.floor(this.vtimeline.width - 2*this.padx);

  // clear
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, this.vtimeline.width, this.vtimeline.height);

  // draw line
  ctx.strokeStyle = '#999999';
  ctx.fillStyle = '#999999';
  ctx.lineWidth = this.DRAW_LINE_WIDTH;
  ctx.beginPath();
  ctx.moveTo(this.padx, 1);
  ctx.lineTo(this.padx + this.vtimelinew, 1);
  ctx.stroke();

  // draw time gratings and corresponding label
  var start = this.padx;
  var time = 0;
  var width_per_tick = 10 * this.char_width;
  var end = this.vtimelinew - width_per_tick;
  var width_per_sec  = this._vtimeline_time2canvas(1);

  ctx.beginPath();
  while ( start <end && time < this.m.duration ) {
    ctx.moveTo(start, 1);
    ctx.lineTo(start, this.lineh - 1);

    time = this._vtimeline_canvas2time(start);
    if ( width_per_sec > width_per_tick ) {
      ctx.fillText(this._time2strms(time), start, this.linehn[2] - 1);
    } else {
      ctx.fillText(this._time2str(time), start, this.linehn[2] - 1);
    }

    start = start + 10*this.char_width;
  }
  ctx.stroke();

  // draw the end mark
  var endx = this._vtimeline_time2canvas(this.m.duration);
  ctx.beginPath();
  ctx.moveTo(endx, 1);
  ctx.lineTo(endx, this.lineh - 1);
  ctx.stroke();
  var tendstr = this._time2strms(this.m.duration);
  var tendstr_width = ctx.measureText(tendstr).width;
  ctx.fillStyle = '#999999';
  ctx.fillText(tendstr, endx - tendstr_width, this.linehn[2] - 1);

  //// timeline mark showing the current video time
  //// and placed just above the full video timeline
  this.vtimeline_mark = document.createElement('canvas');
  this.vtimeline_mark.setAttribute('class', 'video_timeline_mark');
  this.vtimeline_mark_ctx = this.vtimeline_mark.getContext('2d', {alpha:false});
  this.vtimeline_mark.width = this.vtimeline.width;
  this.vtimeline_mark.height = this.linehn[2];

  this.c.appendChild(this.vtimeline_mark);
  this.c.appendChild(this.vtimeline);
}

_via_temporal_segmenter.prototype._vtimeline_time2canvas = function(t) {
  return Math.floor( ( ( this.vtimelinew * t ) / this.m.duration ) + this.padx );
}

_via_temporal_segmenter.prototype._vtimeline_canvas2time = function(x) {
  var t = ( ( x - this.padx ) / this.vtimelinew ) * this.m.duration;
  return Math.max(0, Math.min(t, this.m.duration) );
}

_via_temporal_segmenter.prototype._vtimeline_mark_draw = function() {
  var time = this.m.currentTime;
  var cx = this._vtimeline_time2canvas(time);

  // clear
  this.vtimeline_mark_ctx.font = '16px Mono';
  this.vtimeline_mark_ctx.fillStyle = 'white';
  this.vtimeline_mark_ctx.fillRect(0, 0,
                                   this.vtimeline_mark.width,
                                   this.vtimeline_mark.height);

  // draw arrow
  this.vtimeline_mark_ctx.fillStyle = 'black';
  this.vtimeline_mark_ctx.beginPath();
  this.vtimeline_mark_ctx.moveTo(cx, this.linehn[2]);
  this.vtimeline_mark_ctx.lineTo(cx - this.linehb2, this.lineh);
  this.vtimeline_mark_ctx.lineTo(cx + this.linehb2, this.lineh);
  this.vtimeline_mark_ctx.moveTo(cx, this.linehn[2]);
  this.vtimeline_mark_ctx.fill();

  // draw current time
  this.vtimeline_mark_ctx.fillStyle = '#666666';
  var tstr = this._time2strms(time);
  var twidth = this.vtimeline_mark_ctx.measureText(tstr).width;
  var tx = cx + this.lineh;
  if ( cx + twidth > this.vtimelinew ) {
    tx = tx - twidth - this.linehn[2];
  }
  this.vtimeline_mark_ctx.fillText(tstr, tx, this.linehn[2] - 2);
}

_via_temporal_segmenter.prototype._vtimeline_on_mousedown = function(e) {
  var canvas_x = e.offsetX;
  var time = this._vtimeline_canvas2time(canvas_x);
  this.m.currentTime = time;

  var new_tstart = Math.floor(time);
  this._tmetadata_boundary_update(new_tstart)
  this._tmetadata_gtimeline_draw();
}

_via_temporal_segmenter.prototype._vtimeline_on_mousemove = function(e) {
  var time = this._vtimeline_canvas2time(e.offsetX);
  this._thumbview_show(time, e.offsetX, e.offsetY);
}

_via_temporal_segmenter.prototype._vtimeline_on_mouseout = function(e) {
  this._thumbview_hide();
}

//
// Metadata Panel
//
_via_temporal_segmenter.prototype._tmetadata_init = function(e) {
  this.tmetadata_container = document.createElement('div');
  this.tmetadata_container.setAttribute('class', 'tmetadata_container');

  var cw = this.c.clientWidth;
  this.gid_width = this.linehn[15];
  this.timeline_container_width = cw - this.gid_width - this.linehn[3];
  this.tmetadata_timelinew = this.timeline_container_width - Math.floor(2 * this.padx);
  this.tmetadata_width_per_sec = this.linehn[this.WIDTH_PER_SEC];
  this._tmetadata_boundary_update(0); // determine the boundary of gtimeline

  // header
  var header_container = document.createElement('div');
  header_container.setAttribute('class', 'header_container');
  var header = document.createElement('table');
  var hrow = document.createElement('tr');
  var groupvar_col = document.createElement('td');
  groupvar_col.setAttribute('style', 'width:' + this.gid_width + 'px;');
  //groupvar_col.innerHTML = this.d.attribute_store[this.groupby_aid].attr_name;
  /* // hide as not needed now
  this.groupby_select = document.createElement('select');
  this.groupby_select.setAttribute('title', 'Group creates multiple slices of the timeline where each slice corresponds to one unique value of the group attribute.')
  var aindex, aid;
  for ( aindex in this.d.aid_list ) {
    var oi = document.createElement('option');
    oi.setAttribute('value', this.d.aid_list[aindex]);
    oi.innerHTML = this.d.attribute_store[ this.d.aid_list[aindex] ].attr_name;
    this.groupby_select.appendChild(oi);
  }
  this.groupby_select.addEventListener('change', function(e) {
    var aid = e.target.options[e.target.selectedIndex];
    this._group_init(aid);
  }.bind(this));
  groupvar_col.appendChild(this.groupby_select);
  */

  var gtimeline_col = document.createElement('td');
  this._tmetadata_gtimeline_init();
  gtimeline_col.appendChild(this.gtimeline);
  hrow.appendChild(groupvar_col);
  hrow.appendChild(gtimeline_col);
  header.appendChild(hrow);
  header_container.appendChild(header);
  this.tmetadata_container.appendChild(header_container);

  // metadata
  var metadata_container = document.createElement('div');
  metadata_container.setAttribute('class', 'metadata_container');
  metadata_container.setAttribute('style', 'display:inline-block; max-height:' +
                                  this.lineh * this.METADATA_CONTAINER_HEIGHT +
                                  'px; width:100%; overflow:auto;');

  var metadata_table = document.createElement('table');
  this.metadata_tbody = document.createElement('tbody');

  this.gcanvas = {}; // contains a list of canvas for each group
  this.gctx = {};    // contains the corresponding drawing context
  var gindex, gid;
  for ( gindex in this.gid_list ) {
    gid = this.gid_list[gindex];
    this.metadata_tbody.appendChild( this._tmetadata_group_gid_html(gid) );
  }

  metadata_table.appendChild(this.metadata_tbody);
  metadata_container.appendChild(metadata_table);
  this.tmetadata_container.appendChild(metadata_container);
  this.c.appendChild(this.tmetadata_container);

  if ( this.gid_list.length ) {
    this._tmetadata_group_gid_sel(0);
  }
}

_via_temporal_segmenter.prototype._tmetadata_boundary_move = function(dt) {
  var new_start = Math.floor(this.tmetadata_gtimeline_tstart + dt);
  if ( new_start >= 0 &&
       new_start < this.m.duration
     ) {
    this._tmetadata_boundary_update(new_start);
    if ( this.m.currentTime < this.tmetadata_gtimeline_tstart ) {
      this.m.currentTime = this.tmetadata_gtimeline_tstart;
    } else {
      if ( this.m.currentTime > this.tmetadata_gtimeline_tend ) {
        this.m.currentTime = this.tmetadata_gtimeline_tend;
      }
    }
  } else {
    _via_util_msg_show('Cannot move beyond the video timeline boundary!');
  }
}

_via_temporal_segmenter.prototype._tmetadata_boundary_update = function(tstart) {
  this.tmetadata_gtimeline_tstart = tstart;
  this.tmetadata_gtimeline_xstart = this.padx;

  var t = this.tmetadata_gtimeline_tstart;
  var tx = this.tmetadata_gtimeline_xstart;
  var endx = tx + this.tmetadata_timelinew;
  this.tmetadata_gtimeline_mark_x = [];
  this.tmetadata_gtimeline_mark_time_str = [];
  while ( tx <= endx && t <= this.m.duration ) {
    this.tmetadata_gtimeline_mark_x.push(tx);
    this.tmetadata_gtimeline_mark_time_str.push( this._time2str(t) );

    t = t + 1;
    tx = tx + this.tmetadata_width_per_sec;
    //console.log('t='+t + ',tx=' + tx+', dur='+this.m.duration+',endx='+endx);
  }
  if ( t >= this.m.duration ) {
    this.tmetadata_gtimeline_tend = this.m.duration;
  } else {
    this.tmetadata_gtimeline_tend = t - 1;
  }
  this.tmetadata_gtimeline_xend = this.tmetadata_gtimeline_xstart + (this.tmetadata_gtimeline_tend - this.tmetadata_gtimeline_tstart) * this.tmetadata_width_per_sec;

  //console.log(this.tmetadata_gtimeline_xstart+':'+this.tmetadata_gtimeline_tstart+' - ' + this.tmetadata_gtimeline_xend + ':' + this.tmetadata_gtimeline_tend);

  // asynchronously pull out the metadata in the current group timeline boundary
  this.tmetadata_gtimeline_mid = {};
  setTimeout( this._tmetadata_boundary_fetch_all_mid.bind(this), 0);
}

_via_temporal_segmenter.prototype._tmetadata_boundary_fetch_all_mid = function() {
  var gindex;
  var t0, t1;

  for ( gindex in this.gid_list ) {
    this._tmetadata_boundary_fetch_gid_mid( this.gid_list[gindex] );
    this._tmetadata_group_gid_draw( this.gid_list[gindex] );
  }
}

_via_temporal_segmenter.prototype._tmetadata_boundary_fetch_gid_mid = function(gid) {
  this.tmetadata_gtimeline_mid[gid] = [];
  var mid_list = [];
  var mindex, mid, t0, t1;
  for ( mindex in this.group[gid] ) {
    mid = this.group[gid][mindex];
    t0 = this.d.metadata_store[mid].z[0];
    t1 = this.d.metadata_store[mid].z[1];

    if ( (t0 > this.tmetadata_gtimeline_tstart &&
          t0 < this.tmetadata_gtimeline_tend) ||
         (t1 > this.tmetadata_gtimeline_tstart &&
          t1 < this.tmetadata_gtimeline_tend)
       ) {
      this.tmetadata_gtimeline_mid[gid].push(mid);
    }
  }
}

//
// group timeline (common to all group-id and shown at top)
//
_via_temporal_segmenter.prototype._tmetadata_gtimeline_init = function(container) {
  this.gtimeline = document.createElement('canvas');
  this.gtimeline.setAttribute('class', 'gtimeline');
  this.gtimeline.addEventListener('mousedown', this._tmetadata_gtimeline_mousedown.bind(this));
  this.gtimeline.addEventListener('mouseup', this._tmetadata_gtimeline_mouseup.bind(this));

  this.gtimeline.width = this.timeline_container_width;
  this.gtimeline.height = this.linehn[this.GTIMELINE_HEIGHT];
  this.gtimelinectx = this.gtimeline.getContext('2d', {alpha:false});
}

_via_temporal_segmenter.prototype._tmetadata_gtimeline_clear = function() {
  this.gtimelinectx.fillStyle = '#ffffff';
  this.gtimelinectx.fillRect(0, 0, this.gtimeline.width, this.gtimeline.height);
}

_via_temporal_segmenter.prototype._tmetadata_gtimeline_draw = function() {
  this._tmetadata_gtimeline_clear();

  // draw line
  this.gtimelinectx.strokeStyle = '#707070';
  this.gtimelinectx.fillStyle = '#707070';
  this.gtimelinectx.lineWidth = this.DRAW_LINE_WIDTH;
  this.gtimelinectx.beginPath();
  this.gtimelinectx.moveTo(this.tmetadata_gtimeline_xstart, this.linehn[3]);
  this.gtimelinectx.lineTo(this.tmetadata_gtimeline_xend, this.linehn[3]);
  this.gtimelinectx.stroke();

  // draw tick marks
  this.gtimelinectx.beginPath();
  for ( var i = 0; i < this.tmetadata_gtimeline_mark_x.length; ++i ) {
    this.gtimelinectx.moveTo(this.tmetadata_gtimeline_mark_x[i], this.linehn[3]);
    this.gtimelinectx.lineTo(this.tmetadata_gtimeline_mark_x[i], this.linehn[4]);
  }
  this.gtimelinectx.stroke();

  // draw tick labels
  this.gtimelinectx.fillStyle = '#666666';
  this.gtimelinectx.font = '9px Sans';
  for ( var i = 0; i < this.tmetadata_gtimeline_mark_x.length; ++i ) {
    this.gtimelinectx.fillText(this.tmetadata_gtimeline_mark_time_str[i],
                               this.tmetadata_gtimeline_mark_x[i], this.linehn[5] );
  }

}

_via_temporal_segmenter.prototype._tmetadata_draw_currenttime_mark = function(tnow) {
  // clear previous mark
  this.gtimelinectx.fillStyle = '#ffffff';
  this.gtimelinectx.fillRect(0, 0, this.gtimeline.width, this.linehn[3] - 1);

  var markx = this._tmetadata_gtimeline_time2canvas(tnow);

  this.gtimelinectx.fillStyle = 'black';
  this.gtimelinectx.beginPath();
  this.gtimelinectx.moveTo(markx, this.linehn[3]);
  this.gtimelinectx.lineTo(markx - this.linehb2, this.linehn[2]);
  this.gtimelinectx.lineTo(markx + this.linehb2, this.linehn[2]);
  this.gtimelinectx.moveTo(markx, this.linehn[3]);
  this.gtimelinectx.fill();

  // show playback rate
  this.gtimelinectx.font = '10px Sans';
  var rate = this.m.playbackRate.toFixed(1) + 'X';
  this.gtimelinectx.fillText(rate, this.tmetadata_gtimeline_xend, this.linehn[3] - 2);
}

_via_temporal_segmenter.prototype._tmetadata_gtimeline_canvas2time = function(x) {
  var T = this.tmetadata_gtimeline_tend - this.tmetadata_gtimeline_tstart;
  var W = this.tmetadata_gtimeline_xend - this.tmetadata_gtimeline_xstart;
  var dx = x - this.padx;
  return this.tmetadata_gtimeline_tstart + ((T * dx) / W);
}

_via_temporal_segmenter.prototype._tmetadata_gtimeline_time2canvas = function(t) {
  var canvas_x;
  if ( t < this.tmetadata_gtimeline_tstart ||
       t > this.tmetadata_gtimeline_tend ) {
    // clamp to canvas boundary
    if ( t < this.tmetadata_gtimeline_tstart ) {
      canvas_x = this.tmetadata_gtimeline_xstart;
    } else {
      canvas_x = this.tmetadata_gtimeline_xend;
    }
  } else {
    var sec = Math.floor(t);
    var sec_mark_index = sec - this.tmetadata_gtimeline_tstart;
    var ms = t - sec;
    var ms_x = Math.ceil(ms * this.tmetadata_width_per_sec);
    canvas_x = this.tmetadata_gtimeline_mark_x[sec_mark_index] + ms_x;
  }
  return canvas_x;
}

_via_temporal_segmenter.prototype._tmetadata_gtimeline_mousedown = function(e) {
  var t = this._tmetadata_gtimeline_canvas2time(e.offsetX);
  this.m.currentTime = t;
}

_via_temporal_segmenter.prototype._tmetadata_gtimeline_mouseup = function(e) {
}

//
// metadata for a given group-id
//
_via_temporal_segmenter.prototype._tmetadata_group_update_gid = function(e) {
  var old_gid = e.target.dataset.gid;
  var new_gid = e.target.value.trim();
  var mindex, mid;
  var update_list = [];
  for ( mindex in this.group[old_gid] ) {
    mid = this.group[old_gid][mindex]
    update_list.push( {'mid':mid,
                       'aid':this.groupby_aid,
                       'value':new_gid,
                      } );
  }
  this.d.metadata_update_attribute_value_bulk(this.file.fid, update_list);
}

_via_temporal_segmenter.prototype._tmetadata_group_gid_html = function(gid) {
  var tr = document.createElement('tr');
  tr.setAttribute('data-gid', gid);
  var gid_col = document.createElement('td');
  gid_col.setAttribute('style', 'width:' + this.gid_width + 'px; padding:0.2em 0.5em;');
  var gid_label = document.createElement('input');
  gid_label.setAttribute('type', 'text');
  gid_label.setAttribute('value', gid);
  gid_label.setAttribute('data-gid', gid);
  gid_label.addEventListener('change', this._tmetadata_group_update_gid.bind(this));
  gid_col.appendChild(gid_label);
  tr.appendChild(gid_col);

  var gidtimeline = document.createElement('td');
  this._tmetadata_group_gid_init(gid);
  gidtimeline.appendChild( this.gcanvas[gid] );
  tr.appendChild(gidtimeline);
  return tr;
}

_via_temporal_segmenter.prototype._tmetadata_group_gid_html_del = function(gid) {
  var tr_list = this.metadata_tbody.getElementsByTagName('tr');
  var i;
  for ( i = 0; i < tr_list.length; ++i ) {
    if ( tr_list[i].dataset.gid === gid ) {
      this.metadata_tbody.removeChild(tr_list[i]);
      break;
    }
  }
}

_via_temporal_segmenter.prototype._tmetadata_group_gid_init = function(gid) {
  this.gcanvas[gid] = document.createElement('canvas');
  this.gcanvas[gid].setAttribute('data-gid', gid);
  this.gcanvas[gid].setAttribute('data-gindex', this.gid_list.indexOf(gid));
  this.gcanvas[gid].width = this.timeline_container_width;
  this.gcanvas[gid].height = this.linehn[4];
  this.gctx[gid] = this.gcanvas[gid].getContext('2d', {alpha:false});

  this.gcanvas[gid].addEventListener('mousemove', this._tmetadata_group_gid_mousemove.bind(this));
  this.gcanvas[gid].addEventListener('mousedown', this._tmetadata_group_gid_mousedown.bind(this));
  this.gcanvas[gid].addEventListener('mouseup', this._tmetadata_group_gid_mouseup.bind(this));
  this._tmetadata_group_gid_draw(gid);
}

_via_temporal_segmenter.prototype._tmetadata_group_gid_clear = function(gid) {
  if ( gid === this.selected_gid ) {
    this.gctx[gid].fillStyle = '#e6e6e6';
  } else {
    this.gctx[gid].fillStyle = '#ffffff';
  }
  this.gctx[gid].fillRect(0, 0, this.gcanvas[gid].width, this.gcanvas[gid].height);
}

_via_temporal_segmenter.prototype._tmetadata_group_gid_draw = function(gid) {
  this._tmetadata_group_gid_clear(gid);
  this._tmetadata_group_gid_draw_boundary(gid);
  this._tmetadata_group_gid_draw_metadata(gid);
}

_via_temporal_segmenter.prototype._tmetadata_group_gid_draw_boundary = function(gid) {
  var gindex = this.gid_list.indexOf(gid);
  var bcolor = this.COLOR_LIST[ gindex % this.NCOLOR ];
  // draw line
  this.gctx[gid].strokeStyle = bcolor;
  this.gctx[gid].fillStyle = '#ffffff';
  this.gctx[gid].lineWidth = this.DRAW_LINE_WIDTH;

  this.gctx[gid].beginPath();
  this.gctx[gid].moveTo(this.tmetadata_gtimeline_xstart, this.linehn[1]);
  this.gctx[gid].lineTo(this.tmetadata_gtimeline_xend, this.linehn[1]);
  this.gctx[gid].lineTo(this.tmetadata_gtimeline_xend, this.linehn[3]);
  this.gctx[gid].lineTo(this.tmetadata_gtimeline_xstart, this.linehn[3]);
  this.gctx[gid].lineTo(this.tmetadata_gtimeline_xstart, this.linehn[1]);
  this.gctx[gid].stroke();
}

_via_temporal_segmenter.prototype._tmetadata_group_gid_draw_metadata = function(gid) {
  if ( this.tmetadata_gtimeline_mid.hasOwnProperty(gid) ) {
    var mindex, mid;
    for ( mindex in this.tmetadata_gtimeline_mid[gid] ) {
      mid = this.tmetadata_gtimeline_mid[gid][mindex];
      this._tmetadata_group_gid_draw_mid(gid, mid);
    }
  }
}

_via_temporal_segmenter.prototype._tmetadata_group_gid_draw_mid = function(gid, mid) {
  var t0, t1, x0, x1;
  t0 = this.d.metadata_store[mid].z[0];
  t1 = this.d.metadata_store[mid].z[1];
  x0 = this._tmetadata_gtimeline_time2canvas(t0);
  x1 = this._tmetadata_gtimeline_time2canvas(t1);

  // draw metadata block
  if ( gid === this.selected_gid &&
       mid === this.selected_mid ) {
    this.gctx[gid].fillStyle = '#333333';
    if ( this.metadata_resize_is_ongoing || this.metadata_move_is_ongoing ) {
      if ( this.metadata_resize_is_ongoing ) {
        x0 = this.metadata_ongoing_update_x[0];
        x1 = this.metadata_ongoing_update_x[1];
      } else {
        x0 = this.metadata_ongoing_update_x[0] + this.metadata_move_dx;
        x1 = this.metadata_ongoing_update_x[1] + this.metadata_move_dx;
      }
    }
  } else {
    var gindex = this.gid_list.indexOf(gid);
    var bcolor = this.COLOR_LIST[ gindex % this.NCOLOR ];
    this.gctx[gid].fillStyle = bcolor;
    //this.gctx[gid].fillStyle = '#808080';
  }

  this.gctx[gid].beginPath();
  this.gctx[gid].moveTo(x0, this.linehn[1] + 1);
  this.gctx[gid].lineTo(x1, this.linehn[1] + 1);
  this.gctx[gid].lineTo(x1, this.linehn[3] - 1);
  this.gctx[gid].lineTo(x0, this.linehn[3] - 1);
  this.gctx[gid].lineTo(x0, this.linehn[1] + 1);
  this.gctx[gid].fill();

  // draw arrow extending to the edges of temporal segment
  if ( gid === this.selected_gid &&
       mid === this.selected_mid ) {
    this.gctx[gid].fillStyle = '#f2f2f2';
    this.gctx[gid].strokeStyle = '#e6e6e6';

    this.gctx[gid].lineWidth = this.DRAW_LINE_WIDTH;
    this.gctx[gid].beginPath();
    this.gctx[gid].moveTo(x0 + 2, this.linehn[2]);
    this.gctx[gid].lineTo(x0 + this.linehb2 + 2, this.linehn[2] - this.linehb2);
    this.gctx[gid].lineTo(x0 + this.linehb2 + 2, this.linehn[2] + this.linehb2);
    this.gctx[gid].lineTo(x0 + 2, this.linehn[2]);
    this.gctx[gid].lineTo(x1 - 1, this.linehn[2]);
    this.gctx[gid].lineTo(x1 - this.linehb2 - 1, this.linehn[2] - this.linehb2);
    this.gctx[gid].lineTo(x1 - this.linehb2 - 1, this.linehn[2] + this.linehb2);
    this.gctx[gid].lineTo(x1 - 1, this.linehn[2]);
    this.gctx[gid].stroke();
    this.gctx[gid].fill();

    // draw edge time if an edge is being updated
    if ( this.edge_show_time !== -1 ) {
      this.gctx[gid].font = '10px Sans';
      this.gctx[gid].fillStyle = '#000000';

      var time_str = this._time2ssms(this.d.metadata_store[this.selected_mid].z[this.edge_show_time]);
      if ( this.edge_show_time === 0 ) {
        this.gctx[gid].fillText(time_str, x0 + 1, this.linehn[4]);
      } else {
        var twidth = this.gctx[gid].measureText(time_str).width;
        this.gctx[gid].fillText(time_str, x1 - twidth, this.linehn[4]);
      }
    }
  }
}

_via_temporal_segmenter.prototype._tmetadata_group_gid_sel = function(gindex) {
  var old_selected_gindex = this.selected_gindex;

  this.selected_gindex = gindex;
  this.selected_gid = this.gid_list[this.selected_gindex];
  this.selected_mindex = -1;
  this.selected_mid = '';

  this.edge_show_time = -1;
  this._tmetadata_group_gid_draw(this.selected_gid);
  this.gcanvas[this.selected_gid].scrollIntoView();

  // update old selection
  if ( old_selected_gindex !== -1 ) {
    if ( this.gid_list.hasOwnProperty(old_selected_gindex) ) {
      var old_selected_gid = this.gid_list[old_selected_gindex];
      this._tmetadata_group_gid_draw(old_selected_gid);
    }
  }
}

_via_temporal_segmenter.prototype._tmetadata_group_gid_sel_metadata = function(mindex) {
  var old_selected_mindex = this.selected_mindex;
  this.selected_mindex = mindex;
  this.selected_mid = this.tmetadata_gtimeline_mid[this.selected_gid][mindex];
  this.m.currentTime = this.d.metadata_store[this.selected_mid].z[0];
  this._tmetadata_group_gid_draw(this.selected_gid);
  _via_util_msg_show('Selected metadata [' + this.d.metadata_store[this.selected_mid].z[0] +
                     ', ' + this.d.metadata_store[this.selected_mid].z[1] + ']');
}

_via_temporal_segmenter.prototype._tmetadata_group_gid_remove_mid_sel = function(mindex) {
  this.selected_mindex = -1;
  this.selected_mid = '';
  this.edge_show_time = -1;
  this._tmetadata_group_gid_draw(this.selected_gid);
}

_via_temporal_segmenter.prototype._tmetadata_group_gid_sel_metadata_at_time = function() {
  var t = this.m.currentTime;
  var mindex = this._tmetadata_group_gid_metadata_at_time(t);
  if ( mindex !== -1 ) {
    this._tmetadata_group_gid_sel_metadata(mindex);
  }
}

_via_temporal_segmenter.prototype._tmetadata_group_gid_metadata_at_time = function(t) {
  var mindex, mid;
  for ( mindex in this.tmetadata_gtimeline_mid[this.selected_gid] ) {
    mid = this.tmetadata_gtimeline_mid[this.selected_gid][mindex];
    if ( t >= this.d.metadata_store[mid].z[0] &&
         t <= this.d.metadata_store[mid].z[1]
       ) {
      return parseInt(mindex);
    }
  }
  return -1;
}

_via_temporal_segmenter.prototype._tmetadata_group_gid_sel_next_metadata = function() {
  var sgid = this.gid_list[this.selected_gindex];
  if ( this.selected_mindex === -1 ) {
    if ( this.tmetadata_gtimeline_mid.hasOwnProperty(sgid) ) {
      if ( this.tmetadata_gtimeline_mid[sgid].length ) {
        // select first mid
        this._tmetadata_group_gid_sel_metadata(0);
      }
    }
  } else {
    var next_mindex = this.selected_mindex + 1;
    if ( next_mindex >= this.tmetadata_gtimeline_mid[sgid].length ) {
      next_mindex = 0;
    }
    this._tmetadata_group_gid_sel_metadata(next_mindex);
  }
}

_via_temporal_segmenter.prototype._tmetadata_group_gid_sel_prev_metadata = function() {
  var sgid = this.gid_list[this.selected_gindex];
  if ( this.selected_mindex === -1 ) {
    if ( this.tmetadata_gtimeline_mid.hasOwnProperty(sgid) ) {
      if ( this.tmetadata_gtimeline_mid[sgid].length ) {
        this._tmetadata_group_gid_sel_metadata(this.tmetadata_gtimeline_mid[sgid].length - 1);
      }
    }
  } else {
    var prev_mindex = this.selected_mindex - 1;
    if ( prev_mindex < 0 ) {
      prev_mindex =  this.tmetadata_gtimeline_mid[sgid].length - 1;
    }
    this._tmetadata_group_gid_sel_metadata(prev_mindex);
  }
}

_via_temporal_segmenter.prototype._tmetadata_mid_update_edge = function(eindex, dz) {
  this.edge_show_time = eindex;
  // to ensure only 3 decimal values are stored for time
  var new_value = this.d.metadata_store[this.selected_mid].z[eindex] + dz;
  new_value = _via_util_float_to_fixed(new_value, 3);

  // consistency check
  if ( eindex === 0 ) {
    if ( new_value >= this.d.metadata_store[this.selected_mid].z[1] ) {
      _via_util_msg_show('Cannot update left edge!');
      return;
    }
  } else {
    if ( new_value <= this.d.metadata_store[this.selected_mid].z[0] ) {
      _via_util_msg_show('Cannot update right edge!');
      return;
    }
  }

  this.d.metadata_update_zi(this.file.fid,
                            this.selected_mid,
                            eindex,
                            new_value
                           );
  this.m.currentTime = new_value;
  this._tmetadata_group_gid_draw(this.selected_gid);
}

_via_temporal_segmenter.prototype._tmetadata_mid_move = function(dt) {
  var n = this.d.metadata_store[this.selected_mid].z.length;
  var newz = this.d.metadata_store[this.selected_mid].z;
  var i;
  for ( i = 0; i < n; ++i ) {
    newz[i] = parseFloat((parseFloat(newz[i]) + dt).toFixed(3));
  }
  this.d.metadata_update_z(this.file.fid, this.selected_mid, newz);
  this.m.currentTime = this.d.metadata_store[this.selected_mid].z[0];
  this._tmetadata_group_gid_draw(this.selected_gid);
}

_via_temporal_segmenter.prototype._tmetadata_mid_del_sel = function(mid) {
  this._tmetadata_mid_del(this.selected_mid);
  this._tmetadata_group_gid_remove_mid_sel();
}

_via_temporal_segmenter.prototype._tmetadata_mid_del = function(mid) {
  var mindex = this.tmetadata_gtimeline_mid[this.selected_gid].indexOf(mid);
  if ( mindex !== -1 ) {
    this.tmetadata_gtimeline_mid[this.selected_gid].splice(mindex, 1);

    this._group_gid_del_mid(this.selected_gid, mid);
    this.d.metadata_del(this.file.fid, mid);
    this._tmetadata_group_gid_draw(this.selected_gid);
  }
}

_via_temporal_segmenter.prototype._tmetadata_mid_add_at_time = function(t) {
  var z = [ t ];
  if ( z[0] < 0 ) {
    z[0] = 0.0;
  }

  z[1] = z[0] + this.DEFAULT_TEMPORAL_SEG_LEN;
  if ( z[1] > this.m.duration ) {
    z[1] = this.m.duration;
  }

  z = _via_util_float_arr_to_fixed(z, 3);
  var fid = this.file.fid;
  var xy = [];
  var metadata = {};
  metadata[ this.groupby_aid ] = this.selected_gid;
  this.d.metadata_add(fid, z, xy, metadata).then( function(ok) {
    this._tmetadata_group_gid_draw(this.selected_gid);
  }.bind(this), function(err) {
    _via_util_msg_show('Failed to add metadata!');
    console.log(err);
  }.bind(this));
}

_via_temporal_segmenter.prototype._tmetadata_mid_merge = function(eindex) {
  var merge_mid, new_z;
  if ( eindex === 0 ) {
    var left_mindex = parseInt(this.selected_mindex) - 1;
    if ( left_mindex >= 0 ) {
      merge_mid = this.tmetadata_gtimeline_mid[this.selected_gid][left_mindex];
      new_z = this.d.metadata_store[merge_mid].z[0] - this.d.metadata_store[this.selected_mid].z[0];
    }
  } else {
    var right_mindex = parseInt(this.selected_mindex) + 1;
    if (right_mindex < this.tmetadata_gtimeline_mid[this.selected_gid].length ) {
      merge_mid = this.tmetadata_gtimeline_mid[this.selected_gid][right_mindex];
      new_z = this.d.metadata_store[merge_mid].z[1] - this.d.metadata_store[this.selected_mid].z[1];
    }
  }

  if ( typeof(merge_mid) !== 'undefined' ) {
    this._tmetadata_mid_del(merge_mid);
    // while selected mid remains consistent, mindex changes due to deletion
    this.selected_mindex = this.tmetadata_gtimeline_mid[this.selected_gid].indexOf(this.selected_mid);
    this._tmetadata_mid_update_edge(eindex, new_z);
    _via_util_msg_show('Temporal segments merged.');
  } else {
    _via_util_msg_show('Merge is not possible without temporal segments in the neighbourhood');
  }
}

_via_temporal_segmenter.prototype._tmetadata_group_gid_mousemove = function(e) {
  var x = e.offsetX;
  var gid = e.target.dataset.gid;
  var t = this._tmetadata_gtimeline_canvas2time(x);
  if ( this.metadata_resize_is_ongoing ) {
    this.metadata_ongoing_update_x[ this.metadata_resize_edge_index ] = x;
    this._tmetadata_group_gid_draw(gid);
    return;
  }

  if ( this.metadata_move_is_ongoing ) {
    this.metadata_move_dx = x - this.metadata_move_start_x;
    this._tmetadata_group_gid_draw(gid);
    return;
  }


  var check = this._tmetadata_group_gid_is_on_edge(gid, t);
  if ( check[0] !== -1 ) {
    this.gcanvas[gid].style.cursor = 'ew-resize';
  } else {
    this.gcanvas[gid].style.cursor = 'default';
  }
}

_via_temporal_segmenter.prototype._tmetadata_group_gid_mousedown = function(e) {
  var x = e.offsetX;
  var gid = e.target.dataset.gid;
  var gindex = e.target.dataset.gindex;
  var t = this._tmetadata_gtimeline_canvas2time(x);

  if ( gindex !== this.selected_gindex ) {
    // select this gid
    this._tmetadata_group_gid_sel(gindex);
  }

  var edge = this._tmetadata_group_gid_is_on_edge(gid, t);
  if ( edge[0] !== -1 ) {
    // mousedown was at the edge
    this.metadata_resize_is_ongoing = true;
    this._tmetadata_group_gid_sel_metadata(edge[0]);
    this.metadata_resize_edge_index = edge[1];
    var z = this.d.metadata_store[this.selected_mid].z;
    this.metadata_ongoing_update_x = [ this._tmetadata_gtimeline_time2canvas(z[0]),
                                         this._tmetadata_gtimeline_time2canvas(z[1])
                                       ];
  } else {
    var mindex = this._tmetadata_group_gid_get_mindex_at_time(gid, t);
    if ( mindex !== -1 ) {
      // check if this metadata is selected
      if ( mindex === this.selected_mindex ) {
        // if selected, start move metadata
        this.metadata_move_start_x = x;
        this.metadata_move_is_ongoing = true;
        var z = this.d.metadata_store[this.selected_mid].z;
        this.metadata_ongoing_update_x = [ this._tmetadata_gtimeline_time2canvas(z[0]),
                                             this._tmetadata_gtimeline_time2canvas(z[1])
                                           ];
      } else {
        // else, select metadata
        this._tmetadata_group_gid_sel_metadata(mindex);
      }
    }
  }
}

_via_temporal_segmenter.prototype._tmetadata_group_gid_mouseup = function(e) {
  var x = e.offsetX;
  if ( this.metadata_resize_is_ongoing ) {
    // resize metadata
    var t = this._tmetadata_gtimeline_canvas2time(e.offsetX);
    var dz = t - this.d.metadata_store[this.selected_mid].z[this.metadata_resize_edge_index];
    this._tmetadata_mid_update_edge(this.metadata_resize_edge_index, dz);
    this.metadata_resize_is_ongoing = false;
    this.metadata_resize_edge_index = -1;
    this.metadata_ongoing_update_x = [0, 0];
    return;
  }

  if ( this.metadata_move_is_ongoing ) {
    var dx = x - this.metadata_move_start_x;
    var dt = this._tmetadata_gtimeline_canvas2time(dx);
    this._tmetadata_mid_move(dt);

    this.metadata_move_is_ongoing = false;
    this.metadata_ongoing_update_x = [0, 0];
    return;
  }
}

_via_temporal_segmenter.prototype._tmetadata_group_gid_is_on_edge = function(gid, t) {
  var mindex, mid;
  for ( mindex in this.tmetadata_gtimeline_mid[gid] ) {
    mid = this.tmetadata_gtimeline_mid[gid][mindex];
    if ( Math.abs(t - this.d.metadata_store[mid].z[0]) < this.METADATA_EDGE_TOL ) {
      return [parseInt(mindex), 0];
    } else {
      if ( Math.abs(t - this.d.metadata_store[mid].z[1]) < this.METADATA_EDGE_TOL ) {
        return [parseInt(mindex), 1];
      }
    }
  }
  return [-1, -1];
}

_via_temporal_segmenter.prototype._tmetadata_group_gid_get_mindex_at_time = function(gid, t) {
  var mindex, mid;
  for ( mindex in this.tmetadata_gtimeline_mid[gid] ) {
    mid = this.tmetadata_gtimeline_mid[gid][mindex];
    if ( t >= this.d.metadata_store[mid].z[0] &&
         t <= this.d.metadata_store[mid].z[1]
       ) {
      return parseInt(mindex);
    }
  }
  return -1;
}

//
// keyboard input handler
//
_via_temporal_segmenter.prototype._on_event_keydown = function(e) {
  var fid = this.file.fid;

  // play/pause
  if ( e.key === ' ' ) {
    e.preventDefault();
    if ( this.m.paused ) {
      this.m.play();
      _via_util_msg_show('Playing ...');
    } else {
      this.m.pause();
      _via_util_msg_show('Paused. Press <span class="key">a</span> to add a temporal segment, ' +
                         '<span class="key">Backspace</span> to delete, ' +
                         '<span class="key">Tab</span> to select and ' +
                         '<span class="key">&uarr;</span>&nbsp;<span class="key">&darr;</span> to select speaker.', true);
    }
  }

  // jump 1,...,9 seconds forward or backward
  if ( ['1','2','3','4','5','6','7','8','9'].includes( e.key ) ) {
    if ( e.altKey ) {
      return; // Alt + Num is used to navigated browser tabs
    }
    e.preventDefault();
    var t = this.m.currentTime;
    if ( e.ctrlKey ) {
      t += parseInt(e.key);
    } else {
      t -= parseInt(e.key);
    }
    // clamp
    t = Math.max(0, Math.min(t, this.m.duration));
    this.m.pause();
    this.m.currentTime = t;
    return;
  }

  if ( e.key === 's' || e.key === 'S' ) {
    e.preventDefault();
    this.m.pause();
    if ( e.key === 's' ) {
      if ( this.selected_mindex !== -1 ) {
        this.m.currentTime = this.d.metadata_store[this.selected_mid].z[0];
      } else {
        this.m.currentTime = this.tmetadata_gtimeline_tstart;
      }
    } else {
      this.m.currentTime = 0;
    }
    return;
  }

  if ( e.key === 'e' || e.key === 'E' ) {
    e.preventDefault();
    this.m.pause();
    if ( e.key === 'e' ) {
      if ( this.selected_mindex !== -1 ) {
        this.m.currentTime = this.d.metadata_store[this.selected_mid].z[1];
      } else {
        this.m.currentTime = this.tmetadata_gtimeline_tend;
      }
    } else {
      this.m.currentTime = this.m.duration - 1;
    }
    return;
  }

  // change playback rate
  if ( e.key === '0' ) {
    e.preventDefault();
    this.m.playbackRate = 1;
    return;
  }
  if ( e.key === '+' ) {
    e.preventDefault();
    this.m.playbackRate = this.m.playbackRate + 0.1;
    return;
  }
  if ( e.key === '-' ) {
    e.preventDefault();
    if ( this.m.playbackRate > 0.1 ) {
      this.m.playbackRate = this.m.playbackRate - 0.1;
    }
    return;
  }

  if ( e.key === 'a' ) {
    e.preventDefault();
    var t = this.m.currentTime;
    this._tmetadata_mid_add_at_time(t);
    return;
  }

  if ( e.key === 'Backspace' ) {
    e.preventDefault();
    if ( this.selected_mindex !== -1 ) {
      this._tmetadata_mid_del_sel();
    }
    return;
  }

  if ( e.key === 'm' ) {
    e.preventDefault();
    if ( this.m.muted ) {
      this.m.muted = false;
    } else {
      this.m.muted = true;
    }
    return;
  }

  if ( e.key === 'l' || e.key === 'L') {
    e.preventDefault();
    if ( this.selected_mindex !== -1 ) {
      // resize left edge of selected temporal segment
      if ( e.key === 'l' ) {
        this._tmetadata_mid_update_edge(0, -this.EDGE_UPDATE_TIME_DELTA);
      } else {
        this._tmetadata_mid_update_edge(0, this.EDGE_UPDATE_TIME_DELTA);
      }
      return;
    } else {
      if ( e.key === 'l' ) {
        this.m.currentTime = this.m.currentTime - this.EDGE_UPDATE_TIME_DELTA;
      } else {
        this.m.currentTime = this.m.currentTime - 2*this.EDGE_UPDATE_TIME_DELTA;
      }
    }
  }

  if ( e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    if ( this.selected_mindex !== -1 ) {
      // resize left edge of selected temporal segment
      if ( e.key === 'r' ) {
        this._tmetadata_mid_update_edge(1, this.EDGE_UPDATE_TIME_DELTA);
      } else {
        this._tmetadata_mid_update_edge(1, -this.EDGE_UPDATE_TIME_DELTA);
      }
      return;
    } else {
      if ( e.key === 'r' ) {
        this.m.currentTime = this.m.currentTime + this.EDGE_UPDATE_TIME_DELTA;
      } else {
        this.m.currentTime = this.m.currentTime + 2*this.EDGE_UPDATE_TIME_DELTA;
      }
    }
  }

  // cancel ongoing action or event
  if ( e.key === 'Escape' ) {
    e.preventDefault();

    // hide info panel
    _via_util_hide_info_page();

    this._tmetadata_group_gid_remove_mid_sel();

    return;
  }

  // select temporal segments
  if ( e.key === 'Tab' ) {
    e.preventDefault();

    if ( e.shiftKey ) {
      this._tmetadata_group_gid_sel_prev_metadata();
    } else {
      this._tmetadata_group_gid_sel_next_metadata();
    }
    return;
  }

  if ( e.key === 'Enter' ) {
    e.preventDefault();
    this.m.pause();
    this._tmetadata_group_gid_sel_metadata_at_time();
    return;
  }

  if ( e.key === 'ArrowDown' || e.key === 'ArrowUp' ) {
    // update the attribute being shown below each temporal segment
    e.preventDefault();
    var selected_gindex = this.gid_list.indexOf(this.selected_gid);
    var next_gindex;
    if ( e.key === 'ArrowDown' ) {
      next_gindex = selected_gindex + 1;
      if ( next_gindex >= this.gid_list.length ) {
        next_gindex = 0;
      }
    } else {
      next_gindex = selected_gindex - 1;
      if ( next_gindex < 0 ) {
        next_gindex = this.gid_list.length - 1;
      }
    }
    this._tmetadata_group_gid_sel(next_gindex);
    _via_util_msg_show('Selected group "' + this.selected_gid + '"');
  }

  if ( e.key === 'ArrowLeft' || e.key === 'ArrowRight' ) {
    e.preventDefault();
    if ( this.selected_mindex !== -1 ) {
      if ( e.shiftKey ) {
        // merge current region with left or right metadata
        if ( e.key === 'ArrowLeft' ) {
          this._tmetadata_mid_merge(0);
        } else {
          this._tmetadata_mid_merge(1);
        }
      } else {
        // move selected temporal segment
        if ( e.key === 'ArrowLeft' ) {
          this._tmetadata_mid_move(-this.EDGE_UPDATE_TIME_DELTA);
        } else {
          this._tmetadata_mid_move(this.EDGE_UPDATE_TIME_DELTA);
        }
      }
    } else {
      // move temporal seg. timeline
      var tstart_new;
      if ( e.key === 'ArrowLeft' ) {
        if ( e.shiftKey ) {
          this._tmetadata_boundary_move(-60*this.TEMPORAL_SEG_MOVE_OFFSET);
        } else {
          this._tmetadata_boundary_move(-this.TEMPORAL_SEG_MOVE_OFFSET);
        }
      } else {
        if ( e.shiftKey ) {
          this._tmetadata_boundary_move(60*this.TEMPORAL_SEG_MOVE_OFFSET);
        } else {
          this._tmetadata_boundary_move(this.TEMPORAL_SEG_MOVE_OFFSET);
        }
      }
    }
  }

  if ( e.key === 'F2' ) {
    e.preventDefault();
    _via_util_show_info_page('keyboard_shortcuts');
    return;
  }
}

//
// group by
//

_via_temporal_segmenter.prototype._group_init = function(aid) {
  this.group = {};
  this.groupby_aid = aid;

  var mid, mindex, avalue;
  for ( mindex in this.d.file_mid_list[this.file.fid] ) {
    mid = this.d.file_mid_list[this.file.fid][mindex];
    avalue = this.d.metadata_store[mid].metadata[aid];
    if ( ! this.group.hasOwnProperty(avalue) ) {
      this.group[avalue] = [];
    }
    this.group[avalue].push(mid);
  }

  this.gid_list = Object.keys(this.group).sort();

  // add a default 'background' group
  if ( ! this.group.hasOwnProperty('background') ) {
    this.group['background'] = [];
    this.gid_list.push('background');
  }

  // sort each group elements based on time
  var gid;
  for ( gid in this.group ) {
    this.group[gid].sort( this._compare_mid_by_time.bind(this) );
  }
}

_via_temporal_segmenter.prototype._compare_mid_by_time = function(mid1, mid2) {
  if ( this.d.metadata_store[mid1].z[0] < this.d.metadata_store[mid2].z[0] ) {
    return -1;
  } else {
    return 1;
  }
}

_via_temporal_segmenter.prototype._group_gid_add_mid = function(gid, new_mid) {
  // find the best location
  var i, mindex, mid;
  for ( mindex in this.group[gid] ) {
    mid = this.group[gid][mindex];
    if ( this.d.metadata_store[new_mid].z[0] < this.d.metadata_store[mid].z[0] ) {
      this.group[gid].splice(mindex, 0, new_mid); // insert at correct location
      return;
    }
  }

  // if the insertion was not possible, simply push at the end
  this.group[gid].push(new_mid);
  this._tmetadata_group_gid_draw(gid);
}

_via_temporal_segmenter.prototype._group_gid_del_mid = function(gid, mid) {
  var mindex = this.group[gid].indexOf(mid);
  if ( mindex !== -1 ) {
    this.group[gid].splice(mindex, 1);
  }
  this._tmetadata_group_gid_draw(gid);
}

_via_temporal_segmenter.prototype._group_del_gid = function(gid) {
  if ( Object.keys(this.group).length === 1 ) {
    _via_util_msg_show('Cannot delete the last ' +
                       this.d.attribute_store[this.groupby_aid].attr_name + '!');
    return;
  }

  var mid_list = this.group[gid].slice();
  delete this.group[gid];
  delete this.tmetadata_gtimeline_mid[gid];
  var gindex = this.gid_list.indexOf(gid);
  this.gid_list.splice(gindex, 1);
  delete this.gctx[gid];
  delete this.gcanvas[gid];

  this._tmetadata_group_gid_html_del(gid);

  // remove selection
  var selected_gindex = this.gid_list.indexOf(this.selected_gid);
  var next_gindex = selected_gindex + 1;
  if ( next_gindex >= this.gid_list.length ) {
    next_gindex = 0;
  }
  this._tmetadata_group_gid_sel(next_gindex);

  // delete from store
  this.d.metadata_del_bulk(this.file.fid, mid_list);
  _via_util_msg_show('Deleted ' + this.d.attribute_store[this.groupby_aid].attr_name +
                     ' [' + gid + ']');
}

_via_temporal_segmenter.prototype._group_add_gid = function(gid) {
  if ( this.group.hasOwnProperty(gid) ) {
    _via_util_msg_show(this.d.attribute_store[this.groupby_aid].attr_name +
                       ' [' + gid + '] already exists!');
  } else {
    this.group[gid] = [];
    this.gid_list.push(gid);
    this.metadata_tbody.appendChild( this._tmetadata_group_gid_html(gid) );
    this.new_group_id_input.value = ''; // clear input field
    _via_util_msg_show('Add ' + this.d.attribute_store[this.groupby_aid].attr_name +
                       ' [' + gid + ']');
  }
}

//
// Utility functions
//
_via_temporal_segmenter.prototype._time2str = function(t) {
  var hh = Math.floor(t / 3600);
  var mm = Math.floor( (t - hh * 3600) / 60 );
  var ss = Math.round( t - hh*3600 - mm*60 );
  if ( hh < 10 ) {
    hh = '0' + hh;
  }
  if ( mm < 10 ) {
    mm = '0' + mm;
  }
  if ( ss < 10 ) {
    ss = '0' + ss;
  }
  return hh + ':' + mm + ':' + ss;
}

_via_temporal_segmenter.prototype._time2strms = function(t) {
  var hh = Math.floor(t / 3600);
  var mm = Math.floor( (t - hh * 3600) / 60 );
  var ss = Math.floor( t - hh*3600 - mm*60 );
  var ms = Math.floor( (t - Math.floor(t) ) * 1000 );
  if ( hh < 10 ) {
    hh = '0' + hh;
  }
  if ( mm < 10 ) {
    mm = '0' + mm;
  }
  if ( ss < 10 ) {
    ss = '0' + ss;
  }
  if ( ms < 100 ) {
    ms = '0' + ms;
  }
  return hh + ':' + mm + ':' + ss + '.' + ms;
}

_via_temporal_segmenter.prototype._time2ssms = function(t) {
  var hh = Math.floor(t / 3600);
  var mm = Math.floor( (t - hh * 3600) / 60 );
  var ss = Math.floor( t - hh*3600 - mm*60 );
  var ms = Math.floor( (t - Math.floor(t) ) * 1000 );
  return ss + '.' + ms;
}

_via_temporal_segmenter.prototype._vtimeline_playbackrate2str = function(t) {
  return this.m.playbackRate + 'X';
}

//
// external events
//
_via_temporal_segmenter.prototype._on_event_metadata_del = function(fid, mid) {
  _via_util_msg_show('Metadata deleted');
}

_via_temporal_segmenter.prototype._on_event_metadata_add = function(fid, mid) {
  this._group_gid_add_mid(this.selected_gid, mid); // add at correct location
  this._tmetadata_boundary_fetch_gid_mid(this.selected_gid);
  _via_util_msg_show('Metadata added');
}

//
// Toolbar
//
_via_temporal_segmenter.prototype._toolbar_init = function() {
  var toolbar_container = document.createElement('div');
  toolbar_container.setAttribute('class', 'toolbar_container');

  var pb_mode_container = document.createElement('div');
  var pb_mode_label = document.createElement('span');
  pb_mode_label.innerHTML = 'Playback Mode:';
  pb_mode_container.appendChild(pb_mode_label);

  var pb_normal = document.createElement('input');
  pb_normal.setAttribute('type', 'radio');
  pb_normal.setAttribute('id', 'playback_mode_normal');
  pb_normal.setAttribute('name', 'via_temporal_segmenter_playback_mode');
  pb_normal.setAttribute('value', this.PLAYBACK_MODE.NORMAL);
  pb_normal.setAttribute('checked', '');
  pb_normal.addEventListener('change', this._toolbar_playback_mode_on_change.bind(this));
  pb_mode_container.appendChild(pb_normal);
  var pb_normal_label = document.createElement('label');
  pb_normal_label.setAttribute('for', 'playback_mode_normal');
  pb_normal_label.innerHTML = 'Normal';
  pb_mode_container.appendChild(pb_normal_label);

  var pb_review = document.createElement('input');
  pb_review.setAttribute('type', 'radio');
  pb_review.setAttribute('id', 'playback_mode_review_segment');
  pb_review.setAttribute('name', 'via_temporal_segmenter_playback_mode');
  pb_review.setAttribute('value', this.PLAYBACK_MODE.REVIEW_SEGMENT);
  pb_review.addEventListener('change', this._toolbar_playback_mode_on_change.bind(this));
  pb_mode_container.appendChild(pb_review);
  var pb_review_label = document.createElement('label');
  pb_review_label.setAttribute('for', 'playback_mode_review_segment');
  pb_review_label.innerHTML = 'Review Segments';
  pb_mode_container.appendChild(pb_review_label);

  var pb_annotation = document.createElement('input');
  pb_annotation.setAttribute('type', 'radio');
  pb_annotation.setAttribute('id', 'playback_mode_review_gap');
  pb_annotation.setAttribute('name', 'via_temporal_segmenter_playback_mode');
  pb_annotation.setAttribute('value', this.PLAYBACK_MODE.REVIEW_GAP);
  pb_annotation.addEventListener('change', this._toolbar_playback_mode_on_change.bind(this));
  pb_mode_container.appendChild(pb_annotation);
  var pb_annotation_label = document.createElement('label');
  pb_annotation_label.setAttribute('for', 'playback_mode_review_gap');
  pb_annotation_label.innerHTML = 'Review Gaps';
  pb_mode_container.appendChild(pb_annotation_label);

  var control_container = document.createElement('div');
  var delbtn = document.createElement('button');
  delbtn.setAttribute('data-gid', this.selected_gid);
  delbtn.innerHTML = 'Delete Selected ' + this.d.attribute_store[this.groupby_aid].attr_name;
  delbtn.addEventListener('click', function(e) {
    this._group_del_gid(this.selected_gid);
  }.bind(this));

  this.new_group_id_input = document.createElement('input');
  this.new_group_id_input.setAttribute('type', 'text');
  this.new_group_id_input.setAttribute('size', '16');
  this.new_group_id_input.setAttribute('placeholder', 'New Speaker Name');

  var addbtn = document.createElement('button');
  addbtn.setAttribute('data-gid', this.selected_gid);
  addbtn.innerHTML = 'Add ' + this.d.attribute_store[this.groupby_aid].attr_name;
  addbtn.addEventListener('click', function(e) {
    var new_gid = this.new_group_id_input.value;
    if ( new_gid !== '' ) {
      this._group_add_gid(new_gid.trim());
    } else {
      _via_util_msg_show(this.d.attribute_store[this.groupby_aid].attr_name +
                         ' id cannot be empty!');
    }
  }.bind(this));

  control_container.appendChild(this.new_group_id_input);
  control_container.appendChild(addbtn);
  control_container.appendChild(delbtn);

  toolbar_container.appendChild(pb_mode_container);
  toolbar_container.appendChild(control_container);

  this.c.appendChild(toolbar_container);
}

_via_temporal_segmenter.prototype._toolbar_playback_mode_on_change = function(e) {
  this.current_playback_mode = e.target.value;
  if ( this.current_playback_mode === this.PLAYBACK_MODE.NORMAL ) {
    this._toolbar_playback_rate_set(1);
  }
}

_via_temporal_segmenter.prototype._toolbar_playback_rate_set = function(rate) {
  if ( this.m.playbackRate !== rate ) {
    this.m.playbackRate = rate;
  }
}