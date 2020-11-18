/**
 *
 * @class
 * @classdesc VIA Control Panel
 * @author Abhishek Dutta <adutta@robots.ox.ac.uk>
 * @date 16 May 2019
 *
 */


function _via_control_panel(control_panel_container, via) {
  this._ID = '_via_control_panel_';
  this.c   = control_panel_container;
  this.via = via;

  // registers on_event(), emit_event(), ... methods from
  // _via_event to let this module listen and emit events
  _via_event.call( this );

  this._init();
}

(function () {
  const proto = _via_control_panel.prototype;
  proto.append = append;
  proto._init = _init;
  proto._add_help_tools = _add_help_tools;
  proto._add_view_manager_tools = _add_view_manager_tools;
  proto._add_project_tools = _add_project_tools;
  proto._add_region_shape_selector = _add_region_shape_selector;
  proto._add_spacer = _add_spacer;
  proto._set_region_shape = _set_region_shape;
  proto._page_show_import_export = _page_show_import_export;
  proto._page_on_action_import = _page_on_action_import;
  proto._page_on_action_export = _page_on_action_export;
  proto._project_load_on_local_file_select = _project_load_on_local_file_select;
  proto._project_load_on_local_file_read = _project_load_on_local_file_read;
  proto._project_import_via2_on_local_file_read = _project_import_via2_on_local_file_read;
  proto._add_project_share_tools = _add_project_share_tools;
  proto._share_show_info = _share_show_info;
  proto._share_show_pull = _share_show_pull;
  proto._page_on_action_open_shared = _page_on_action_open_shared;
  proto._page_on_action_fileuri_bulk_add = _page_on_action_fileuri_bulk_add;
  proto.fileuri_bulk_add_image_from_file = fileuri_bulk_add_image_from_file;
  proto.fileuri_bulk_add_audio_from_file = fileuri_bulk_add_audio_from_file;
  proto.fileuri_bulk_add_video_from_file = fileuri_bulk_add_video_from_file;
  proto.fileuri_bulk_add_auto_from_file = fileuri_bulk_add_auto_from_file;
  proto.fileuri_bulk_add_from_url_list = fileuri_bulk_add_from_url_list;

  function append(el) {
    this.c.appendChild(el);
  }

  function __create_tool_group(id) {
    const group = document.createElement('div');
    group.classList.add("tool-group")
    group.setAttribute('id', id);
    return group;
  }

  function _init(type) {

    this.c.innerHTML = '';

    var logo_panel = document.createElement('div');
    logo_panel.setAttribute('class', 'logo');
    // logo_panel.innerHTML = '<a href="http://www.robots.ox.ac.uk/~vgg/software/via/" title="VGG Image Annotator (VIA)" target="_blank">VIA</a>'
    logo_panel.innerHTML = '<svg width="68" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1000 168.96"><defs><linearGradient id="a" y1="84.48" x2="1000" y2="84.48" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff"></stop><stop offset="0.11" stop-color="#fff" stop-opacity="0.797"></stop><stop offset="0.239" stop-color="#fff" stop-opacity="0.588"></stop><stop offset="0.37" stop-color="#fff" stop-opacity="0.408"></stop><stop offset="0.499" stop-color="#fff" stop-opacity="0.261"></stop><stop offset="0.628" stop-color="#fff" stop-opacity="0.147"></stop><stop offset="0.755" stop-color="#fff" stop-opacity="0.065"></stop><stop offset="0.88" stop-color="#fff" stop-opacity="0.016"></stop><stop offset="1" stop-color="#fff" stop-opacity="0"></stop></linearGradient></defs><title>logo</title><polygon points="1000 33.576 1000 0 33.576 0 0 0 0 33.576 0 67.692 0 101.268 0 135.384 0 168.96 33.576 168.96 1000 168.96 1000 135.384 33.576 135.384 33.576 101.268 1000 101.268 1000 67.692 33.576 67.692 33.576 33.576 1000 33.576" style="fill:url(#a)"></polygon></svg>';
    this.append(logo_panel);

    this.append(this.via.vm.c);
    this._add_view_manager_tools();

    this._add_spacer();

    this._add_project_tools();

    this._add_spacer();

    this._add_region_shape_selector();

    this._add_spacer();

    var editor = _via_util_get_svg_button('micon_insertcomment', 'Show/Hide Attribute Editor');
    editor.addEventListener('click', function() {
      this.emit_event( 'editor_toggle', {});
    }.bind(this));
    this.append(editor);

    this._add_spacer();

    // if ( document.getElementById('micon_zoomin') ) {
    //   var zoom = _via_util_get_svg_button('micon_zoomin', 'Enable/disable magnifying glass to inspect finer details');
    //   zoom.addEventListener('click', function() {
    //     this.emit_event( 'zoom_toggle', {});
    //   }.bind(this));
    //   this.append(zoom);
    //   this._add_spacer();
    // }

    this._add_project_share_tools();

    this._add_spacer();

    this._add_help_tools();
  }

  function _add_spacer() {
    var spacer = document.createElement('div');
    spacer.setAttribute('class', 'spacer');
    this.append(spacer);
  }

  function _add_help_tools() {
    const group = __create_tool_group('help-tools');

    const keyboard = _via_util_get_svg_button('micon_keyboard', 'Keyboard Shortcuts');
    keyboard.addEventListener('click', function() {
      _via_util_page_show('page_keyboard_shortcut');
    });
    group.appendChild(keyboard);

    const help = _via_util_get_svg_button('micon_help', 'About VIA');
    help.addEventListener('click', function() {
      _via_util_page_show('page_about');
    });
    group.appendChild(help);

    this.append(group);
  }

  function _add_view_manager_tools() {
    const group = __create_tool_group('view-manager-tools');

    var prev_view = _via_util_get_svg_button('micon_navigate_prev', 'Show Previous File', 'show_prev');
    prev_view.addEventListener('click', this.via.vm._on_prev_view.bind(this.via.vm));
    group.appendChild(prev_view);

    var next_view = _via_util_get_svg_button('micon_navigate_next', 'Show Next File', 'show_next');
    next_view.addEventListener('click', this.via.vm._on_next_view.bind(this.via.vm));
    group.appendChild(next_view);

    var add_media_local = _via_util_get_svg_button('micon_add_circle', 'Add Audio or Video File in Local Computer', 'add_media_local');
    add_media_local.addEventListener('click', this.via.vm._on_add_media_local.bind(this.via.vm));
    group.appendChild(add_media_local);

    var add_media_bulk = _via_util_get_svg_button('micon_lib_add', 'Bulk add file URI ( e.g. file:///... or http://... ) contained in a local CSV file where each row is a remote or local filename.', 'add_media_bulk');
    //add_media_bulk.addEventListener('click', this.via.vm._on_add_media_bulk.bind(this.via.vm));
    add_media_bulk.addEventListener('click', function() {
      var action_map = {
        'via_page_fileuri_button_bulk_add':this._page_on_action_fileuri_bulk_add.bind(this),
      }
      _via_util_page_show('page_fileuri_bulk_add', action_map);
    }.bind(this));
    group.appendChild(add_media_bulk);

    var del_view = _via_util_get_svg_button('micon_remove_circle', 'Remove the Current File', 'remove_media');
    del_view.addEventListener('click', this.via.vm._on_del_view.bind(this.via.vm));
    group.appendChild(del_view);

    this.append(group);
  }

  function _add_region_shape_selector() {
    const group = __create_tool_group('shape-tools');

    if ( document.getElementById('shape_point') === null ) {
      return;
    }

    const rect = _via_util_get_svg_button('shape_rectangle', 'Rectangle', 'RECTANGLE');
    rect.addEventListener('click', function() {
      this._set_region_shape('RECTANGLE');
    }.bind(this));
    group.appendChild(rect);

    const extreme_rect = _via_util_get_svg_button('shape_extreme_rectangle', 'Extreme rectangle is defined using four points along the boundary of a rectangular object.', 'EXTREME_RECTANGLE');
    extreme_rect.classList.add('shape_selector');
    extreme_rect.addEventListener('click', function() {
      this._set_region_shape('EXTREME_RECTANGLE');
    }.bind(this));
    group.appendChild(extreme_rect);

    const circle = _via_util_get_svg_button('shape_circle', 'Circle', 'CIRCLE');
    circle.addEventListener('click', function() {
      this._set_region_shape('CIRCLE');
    }.bind(this));
    group.appendChild(circle);

    const extreme_circle = _via_util_get_svg_button('shape_extreme_circle', 'Extreme circle is defined using any three points along the circumference of a circular object.', 'EXTREME_CIRCLE');
    extreme_circle.addEventListener('click', function() {
      this._set_region_shape('EXTREME_CIRCLE');
    }.bind(this));
    group.appendChild(extreme_circle);

    const ellipse = _via_util_get_svg_button('shape_ellipse', 'Ellipse', 'ELLIPSE');
    ellipse.addEventListener('click', function() {
      this._set_region_shape('ELLIPSE');
    }.bind(this));
    group.appendChild(ellipse);

    const line = _via_util_get_svg_button('shape_line', 'Line', 'LINE');
    line.addEventListener('click', function() {
      this._set_region_shape('LINE');
    }.bind(this));
    group.appendChild(line);

    const polygon = _via_util_get_svg_button('shape_polygon', 'Polygon', 'POLYGON');
    polygon.addEventListener('click', function() {
      this._set_region_shape('POLYGON');
    }.bind(this));
    group.appendChild(polygon);

    const polyline = _via_util_get_svg_button('shape_polyline', 'Polyline', 'POLYLINE');
    polyline.addEventListener('click', function() {
      this._set_region_shape('POLYLINE');
    }.bind(this));
    group.appendChild(polyline);

    const point = _via_util_get_svg_button('shape_point', 'Point', 'POINT');
    point.addEventListener('click', function() {
      this._set_region_shape('POINT');
    }.bind(this));
    group.appendChild(point);

    this.append(group);

    this.shape_selector_list = { 'POINT':point, 'RECTANGLE':rect, 'EXTREME_RECTANGLE':extreme_rect, 'CIRCLE':circle, 'EXTREME_CIRCLE':extreme_circle, 'ELLIPSE':ellipse, 'LINE':line, 'POLYGON':polygon, 'POLYLINE':polyline };
  }

  function _set_region_shape(shape) {
    this.emit_event( 'region_shape', {'shape':shape});
    for ( var si in this.shape_selector_list ) {
      if ( si === shape ) {
        this.shape_selector_list[si].classList.add('selected'); //'svg_button_selected');
      } else {
        this.shape_selector_list[si].classList.remove('selected'); //'svg_button_selected');
      }
    }
  }

  function _add_project_tools() {
    var load = _via_util_get_svg_button('micon_open', 'Open a VIA Project');
    load.addEventListener('click', function() {
      _via_util_file_select_local(_VIA_FILE_SELECT_TYPE.JSON, this._project_load_on_local_file_select.bind(this), false);
    }.bind(this));
    this.append(load);

    var save = _via_util_get_svg_button('micon_save', 'Save current VIA Project');
    save.addEventListener('click', function() {
      this.via.d.project_save();
    }.bind(this));
    this.append(save);

    var import_export_annotation = _via_util_get_svg_button('micon_import_export', 'Import or Export Annotations');
    import_export_annotation.addEventListener('click', this._page_show_import_export.bind(this));
    this.append(import_export_annotation);
  }

  function _page_show_import_export(d) {
    var action_map = {
      'via_page_button_import':this._page_on_action_import.bind(this),
      'via_page_button_export':this._page_on_action_export.bind(this),
    }
    _via_util_page_show('page_import_export', action_map);
  }

  function _page_on_action_import(d) {
    if ( d._action_id === 'via_page_button_import' ) {
      if ( d.via_page_import_pid !== '' ) {
        this.via.s._project_pull(d.via_page_import_pid).then( function(remote_rev) {
          try {
            var project = JSON.parse(remote_rev);
            // clear remote project identifiers
            project.project.pid = _VIA_PROJECT_ID_MARKER;
            project.project.rev = _VIA_PROJECT_REV_ID_MARKER;
            project.project.rev_timestamp = _VIA_PROJECT_REV_TIMESTAMP_MARKER;
            this.via.d.project_load_json(project);
          }
          catch(e) {
            _via_util_msg_show('Malformed response from server: ' + e);
          }
        }.bind(this), function(err) {
          _via_util_msg_show(err + ': ' + d.via_page_import_pid);
        }.bind(this));
        return;
      }

      if ( d.via_page_import_via2_project_json.length === 1 ) {
        _via_util_load_text_file(d.via_page_import_via2_project_json[0],
                                this._project_import_via2_on_local_file_read.bind(this)
                                );
        return;
      }
      _via_util_msg_show('To import an existing shared project, you must enter its project-id.');
    }
  }

  function _page_on_action_export(d) {
    if ( d._action_id === 'via_page_button_export' ) {
      this.via.ie.export_to_file(d.via_page_export_format);
    }
  }

  function _project_load_on_local_file_select(e) {
    if ( e.target.files.length === 1 ) {
      _via_util_load_text_file(e.target.files[0], this._project_load_on_local_file_read.bind(this));
    }
  }

  function _project_load_on_local_file_read(project_data_str) {
    this.via.d.project_load(project_data_str);
  }

  function _project_import_via2_on_local_file_read(project_data_str) {
    this.via.d.project_import_via2_json(project_data_str);
  }

  function _add_project_share_tools() {
    if ( this.via.s ) {
      var share = _via_util_get_svg_button('micon_share', 'Information about sharing this VIA project with others for collaborative annotation');
      share.addEventListener('click', function() {
        this._share_show_info();
      }.bind(this));
      var push = _via_util_get_svg_button('micon_upload', 'Push (i.e. share this project or share your updates made to this project)');
      push.addEventListener('click', function() {
        this.via.s.push();
      }.bind(this));

      var pull = _via_util_get_svg_button('micon_download', 'Pull (i.e. open a shared project or fetch updates for the current project)');
      pull.addEventListener('click', function() {
        this._share_show_pull();
      }.bind(this));

      this.append(share);
      this.append(push);
      this.append(pull);
    }
  }

  function _share_show_info() {
    if ( this.via.d.project_is_remote() ) {
      this.via.s.exists(this.via.d.store.project.pid).then( function() {
        this.via.s._project_pull(this.via.d.store.project.pid).then( function(ok) {
          try {
            var d = JSON.parse(ok);
            var remote_rev_timestamp = new Date( parseInt(d.project.rev_timestamp) );
            var local_rev_timestamp = new Date( parseInt(this.via.d.store.project.rev_timestamp) );

            var pinfo = '<table>';
            pinfo += '<tr><td>Project Id</td><td>' + d.project.pid + '</td></tr>';
            pinfo += '<tr><td>Remote Revision</td><td>' + d.project.rev + ' (' + remote_rev_timestamp.toUTCString() + ')</td></tr>';
            pinfo += '<tr><td>Local Revision</td><td>' + this.via.d.store.project.rev + ' (' + local_rev_timestamp.toUTCString() + ')</td></tr>';
            pinfo += '</table>';
            if ( d.project.rev !== this.via.d.store.project.rev ) {
              pinfo += '<p>Your version of this project is <span style="color:red;">old</span>. Press <svg class="svg_icon" onclick="" viewbox="0 0 24 24"><use xlink:href="#micon_download"></use></svg> to fetch the most recent version of this project.</p>';
            } else {
              pinfo += '<p>You already have the <span style="color:blue;">latest</span> revision of this project.</p>';
            }

            document.getElementById('via_page_share_project_info').innerHTML = pinfo;
            document.getElementById('via_page_share_project_id').innerHTML = d.project.pid;
            _via_util_page_show('page_share_already_shared');
          }
          catch(e) {
            console.log(e)
            _via_util_msg_show('Malformed server response.' + e);
          }
        }.bind(this), function(pull_err) {
          _via_util_msg_show('Failed to pull project.');
          console.warn(pull_err);
        }.bind(this));
      }.bind(this), function(exists_err) {
        _via_util_page_show('page_share_not_shared_yet');
        console.warn(exists_err);
      }.bind(this));
    } else {
      _via_util_page_show('page_share_not_shared_yet');
    }
  }

  function _share_show_pull() {
    if ( this.via.d.project_is_remote() ) {
      // check if remote project has newer version
      this.via.s._project_pull(this.via.d.store.project.pid).then( function(ok) {
        try {
          var d = JSON.parse(ok);
          if ( d.project.rev === this.via.d.store.project.rev ) {
            _via_util_msg_show('You already have the latest revision of this project');
            return;
          } else {
            this.via.d.project_merge_rev(d);
          }
        }
        catch(e) {
          _via_util_msg_show('Malformed response from server.');
          console.warn(e);
        }
      }.bind(this), function(err) {
        _via_util_msg_show('Failed to pull project.');
        console.warn(err);
      }.bind(this));
    } else {
      var action_map = {
        'via_page_button_open_shared':this._page_on_action_open_shared.bind(this),
      }
      _via_util_page_show('page_share_open_shared', action_map);
    }
  }

  function _page_on_action_open_shared(d) {
    if ( d._action_id === 'via_page_button_open_shared' ) {
      this.via.s.pull(d.via_page_input_pid);
    }
  }

  function _page_on_action_fileuri_bulk_add(d) {
    if ( d.via_page_fileuri_urilist.length ) {
      this.fileuri_bulk_add_from_url_list(d.via_page_fileuri_urilist);
    }

    if ( d.via_page_fileuri_importfile.length === 1 ) {
      switch( parseInt(d.via_page_fileuri_filetype) ) {
      case _VIA_FILE_TYPE.IMAGE:
        _via_util_load_text_file(d.via_page_fileuri_importfile[0], this.fileuri_bulk_add_image_from_file.bind(this));
        break;
      case _VIA_FILE_TYPE.AUDIO:
        _via_util_load_text_file(d.via_page_fileuri_importfile[0], this.fileuri_bulk_add_audio_from_file.bind(this));
        break;
      case _VIA_FILE_TYPE.VIDEO:
        _via_util_load_text_file(d.via_page_fileuri_importfile[0], this.fileuri_bulk_add_video_from_file.bind(this));
        break;
      default:
        _via_util_load_text_file(d.via_page_fileuri_importfile[0], this.fileuri_bulk_add_auto_from_file.bind(this));
      }

    }
  }

  function fileuri_bulk_add_image_from_file(uri_list_str) {
    this.fileuri_bulk_add_from_url_list(uri_list_str, _VIA_FILE_TYPE.IMAGE);
  }

  function fileuri_bulk_add_audio_from_file(uri_list_str) {
    this.fileuri_bulk_add_from_url_list(uri_list_str, _VIA_FILE_TYPE.AUDIO);
  }

  function fileuri_bulk_add_video_from_file(uri_list_str) {
    this.fileuri_bulk_add_from_url_list(uri_list_str, _VIA_FILE_TYPE.VIDEO);
  }

  function fileuri_bulk_add_auto_from_file(uri_list_str) {
    this.fileuri_bulk_add_from_url_list(uri_list_str, 0);
  }

  function fileuri_bulk_add_from_url_list(uri_list_str, type) {
    var uri_list = uri_list_str.split('\n');
    if ( uri_list.length ) {
      var filelist = [];
      for ( var i = 0; i < uri_list.length; ++i ) {
        if ( uri_list[i] === '' ||
            uri_list[i] === ' ' ||
            uri_list[i] === '\n'
          ) {
          continue; // skip
        }
        var filetype;
        if ( type === 0 || typeof(type) === 'undefined' ) {
          filetype = _via_util_infer_file_type_from_filename(uri_list[i]);
        } else {
          filetype = type;
        }

        filelist.push({ 'fname':uri_list[i],
                        'type':filetype,
                        'loc':_via_util_infer_file_loc_from_filename(uri_list[i]),
                        'src':uri_list[i],
                      });
      }
      this.via.vm._file_add_from_filelist(filelist);
    }
  }

})();