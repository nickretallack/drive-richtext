// Generated by CoffeeScript 1.7.1
(function() {
  var CollaborativeRichText, random_character, random_id;

  random_character = function() {
    var chars;
    chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return chars.charAt(Math.floor(Math.random() * chars.length));
  };

  random_id = function(length) {
    var _;
    return ((function() {
      var _i, _results;
      _results = [];
      for (_ = _i = 0; 0 <= length ? _i <= length : _i >= length; _ = 0 <= length ? ++_i : --_i) {
        _results.push(random_character());
      }
      return _results;
    })()).join('');
  };

  CollaborativeRichText = (function() {
    function CollaborativeRichText(_arg) {
      var handlers, name, parent;
      this.model = _arg.model, parent = _arg.parent, name = _arg.name, handlers = _arg.handlers;
      if (handlers == null) {
        handlers = {};
      }
      this.setup_model(parent, name);
      this.setup_events(handlers);
      this.run_initial_events(handlers);
    }

    CollaborativeRichText.prototype.setup_model = function(parent, name) {
      this.obj = this.get_or_create_field(this.model.createMap, parent, name);
      this.str = this.get_or_create_field(this.model.createString, this.obj, 'text');
      return this.overlays = this.get_or_create_field(this.model.createList, this.obj, 'overlays');
    };

    CollaborativeRichText.prototype.get_or_create_field = function(constructor, parent, name) {
      var result;
      result = parent.get(name);
      if (!result) {
        result = constructor.call(this.model);
        parent.set(name, result);
      }
      return result;
    };

    CollaborativeRichText.prototype.setup_events = function(handlers) {
      this.overlays.addEventListener(gapi.drive.realtime.EventType.VALUES_ADDED, function(event) {
        if (handlers.preview_add_overlay) {
          event.values.forEach(handlers.preview_add_overlay);
        }
        if (handlers.apply_format && !event.isLocal) {
          event.values.forEach(function(item) {
            return handlers.apply_format(item, true);
          });
        }
      });
      this.overlays.addEventListener(gapi.drive.realtime.EventType.VALUES_REMOVED, function(event) {
        if (handlers.preview_remove_overlay) {
          event.values.forEach(handlers.preview_remove_overlay);
        }
        if (handlers.apply_format && !event.isLocal) {
          event.values.forEach(function(item) {
            return handlers.apply_format(item, false);
          });
        }
      });
      this.str.addEventListener(gapi.drive.realtime.EventType.TEXT_INSERTED, function(event) {
        if (!event.isLocal) {
          console.log('INSERTED', event.index, event.text);
          if (typeof handlers.insert_text === "function") {
            handlers.insert_text(event.index, event.text);
          }
        }
      });
      return this.str.addEventListener(gapi.drive.realtime.EventType.TEXT_DELETED, function(event) {
        if (!event.isLocal) {
          console.log('DELETED', event.index, event.text);
          if (typeof handlers.delete_text === "function") {
            handlers.delete_text(event.index, event.text);
          }
        }
      });
    };

    CollaborativeRichText.prototype.run_initial_events = function(handlers) {
      if (typeof handlers.insert_text === "function") {
        handlers.insert_text(0, this.str.getText());
      }
      if (handlers.preview_add_overlay) {
        this.overlays.asArray().forEach(handlers.preview_add_overlay);
      }
      if (handlers.apply_format) {
        return this.overlays.asArray().forEach((function(_this) {
          return function(item) {
            return handlers.apply_format(item, true);
          };
        })(this));
      }
    };

    CollaborativeRichText.prototype.debug_overlays = function() {
      var attribute, attributes, overlay, overlays, _i, _len, _ref;
      attributes = {};
      _ref = this.overlays.asArray();
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        overlay = _ref[_i];
        attribute = overlay.get('attribute');
        if (attributes[attribute] == null) {
          attributes[attribute] = [];
        }
        attributes[attribute].push({
          start: overlay.get('start').index,
          end: overlay.get('end').index
        });
      }
      for (attribute in attributes) {
        overlays = attributes[attribute];
        overlays.sort(function(a, b) {
          var start_comparison;
          start_comparison = a.start - b.start;
          if (start_comparison === 0) {
            return a.end - b.end;
          }
          return start_comparison;
        });
      }
      return attributes;
    };

    CollaborativeRichText.prototype.create_overlay = function(start_index, end_index, attribute) {
      var end_ref, start_ref;
      console.log('create overlay:', start_index, end_index, attribute);
      start_ref = this.str.registerReference(start_index, gapi.drive.realtime.IndexReference.DeleteMode.SHIFT_AFTER_DELETE);
      end_ref = this.str.registerReference(end_index, gapi.drive.realtime.IndexReference.DeleteMode.SHIFT_BEFORE_DELETE);
      this.overlays.push(this.model.createMap({
        start: start_ref,
        end: end_ref,
        attribute: attribute,
        id: random_id(20)
      }));
    };

    CollaborativeRichText.prototype.remove_overlay = function(overlay) {
      console.log('remove overlay', overlay.get('start').index, overlay.get('end').index, overlay.get('attribute'));
      this.overlays.removeValue(overlay);
    };

    CollaborativeRichText.prototype.find_colliding_overlay = function(attribute, index) {
      var overlay, _i, _len, _ref;
      _ref = this.overlays.asArray();
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        overlay = _ref[_i];
        if (attribute === overlay.get('attribute') && overlay.get('start').index <= index && overlay.get('end').index >= index) {
          return overlay;
        }
      }
    };

    CollaborativeRichText.prototype.delete_overlay_range = function(start_index, end_index) {
      var deletable_overlays, overlay, _i, _len;
      deletable_overlays = this.overlays.asArray().filter(function(overlay) {
        var overlay_end, overlay_start;
        overlay_start = overlay.get('start').index;
        overlay_end = overlay.get('end').index;
        return overlay_start >= start_index && overlay_end <= end_index;
      });
      for (_i = 0, _len = deletable_overlays.length; _i < _len; _i++) {
        overlay = deletable_overlays[_i];
        this.remove_overlay(overlay);
      }
    };

    CollaborativeRichText.prototype.split_or_remove_overlay = function(start_index, end_index, attribute) {
      var matches_end, matches_start, overlay, overlay_end, overlay_start;
      overlay = this.find_colliding_overlay(attribute, start_index);
      if (!overlay) {
        console.log('ANOMALY - deleted overlay that wasn\'t found');
        return;
      }
      overlay_start = overlay.get('start');
      overlay_end = overlay.get('end');
      matches_start = start_index === overlay_start.index;
      matches_end = end_index === overlay_end.index;
      this.remove_overlay(overlay);
      if (matches_start && matches_end) {
        console.log('remove whole overlay', attribute);
      } else if (matches_start) {
        console.log('remove beginning of overlay', attribute);
        this.create_overlay(end_index, overlay_end.index, attribute);
      } else if (matches_end) {
        console.log('remove end of overlay', attribute);
        this.create_overlay(overlay_start.index, start_index, attribute);
      } else {
        this.split_overlay(overlay, start_index, end_index, attribute);
      }
    };

    CollaborativeRichText.prototype.split_overlay = function(overlay, start_index, end_index, attribute) {
      console.log('split overlay', attribute);
      this.create_overlay(overlay.get('start').index, start_index, attribute);
      return this.create_overlay(end_index, overlay.get('end').index, attribute);
    };

    CollaborativeRichText.prototype.extend_or_create_overlay = function(start_index, end_index, attribute) {
      var found_end, found_start;
      found_start = this.find_colliding_overlay(attribute, start_index);
      found_end = this.find_colliding_overlay(attribute, end_index);
      if (found_start && found_end) {
        this.connect_two_overlays(found_start, found_end, attribute);
      } else if (found_start) {
        this.extend_overlay_forward(found_start, end_index, attribute);
      } else if (found_end) {
        this.extend_overlay_backward(found_end, start_index, attribute);
      } else {
        console.log('create new overlay', attribute);
        this.create_overlay(start_index, end_index, attribute);
      }
    };

    CollaborativeRichText.prototype.connect_two_overlays = function(first_overlay, second_overlay, attribute) {
      console.log('connect two overlays', attribute);
      this.remove_overlay(first_overlay);
      this.remove_overlay(second_overlay);
      return this.create_overlay(first_overlay.get('start').index, second_overlay.get('end').index, attribute);
    };

    CollaborativeRichText.prototype.extend_overlay_forward = function(overlay, end_index, attribute) {
      console.log('extend overlay forward', attribute);
      this.remove_overlay(overlay);
      return this.create_overlay(overlay.get('start').index, end_index, attribute);
    };

    CollaborativeRichText.prototype.extend_overlay_backward = function(overlay, start_index, attribute) {
      console.log('extend overlay backward', attribute);
      this.remove_overlay(overlay);
      return this.create_overlay(start_index, overlay.get('end').index, attribute);
    };

    CollaborativeRichText.prototype.formatText = function(index, length, attributes) {
      var attribute, end_index, value;
      end_index = index + length;
      for (attribute in attributes) {
        value = attributes[attribute];
        if (value) {
          this.extend_or_create_overlay(index, end_index, attribute);
        } else {
          this.split_or_remove_overlay(index, end_index, attribute);
        }
      }
    };

    CollaborativeRichText.prototype.insertText = function(index, text, attributes) {
      this.str.insertString(index, text);
      this.formatText(index, text.length, attributes);
    };

    CollaborativeRichText.prototype.deleteText = function(index, length) {
      var end_index;
      end_index = index + length;
      this.delete_overlay_range(index, end_index);
      this.str.removeRange(index, end_index);
    };

    return CollaborativeRichText;

  })();

  window.CollaborativeRichText = CollaborativeRichText;

}).call(this);
