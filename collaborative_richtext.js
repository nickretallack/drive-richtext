function CollaborativeRichText(model, parent, name, insert_text, delete_text, apply_format, preview_overlay, remove_overlay_preview) {

  // Create the model
  var string_name = 'text';
  var overlays_name = 'overlays'

  obj = parent.get(name)
  if (!obj) {
    obj = model.createMap();
    parent.set(name, obj)
  }

  var str = obj.get(string_name);
  if (!str) {
    str = model.createString();
    obj.set(string_name, str)
  }

  var overlays = obj.get(overlays_name);
  if (!overlays) {
    overlays = model.createList()
    obj.set(overlays_name, overlays)
  }

  // Helper functions
  var auto_incrementer = 0;

  function create_overlay(start_index, end_index, attribute) {
    console.log('create overlay:', start_index, end_index, attribute)
    var start_ref = str.registerReference(start_index, gapi.drive.realtime.IndexReference.DeleteMode.SHIFT_BEFORE_DELETE);
    var end_ref = str.registerReference(end_index, gapi.drive.realtime.IndexReference.DeleteMode.SHIFT_BEFORE_DELETE);
    overlays.push(
      model.createMap({
        start: start_ref,
        end: end_ref,
        attribute: attribute,
        id: auto_incrementer++
      })
    )
  }

  function remove_overlay(index) {
    var overlay = overlays.get(index);
    console.log("remove overlay", overlay.get('start').index, overlay.get('end').index, overlay.get('attribute'));
    overlays.remove(index);
  }

  function find_colliding_overlay(overlays, attribute, index) {
    var items = overlays.asArray()
    for (var i = 0; i < items.length; i++) {
      var overlay = items[i];
      if (attribute === overlay.get('attribute')
        && overlay.get('start').index <= index
        && overlay.get('end').index >= index) {
        return {index:i, overlay: overlay}
      }
    }
  }

  function delete_overlay_range(start_index, end_index) {
    var deletable_overlays = overlays.asArray().filter(function(overlay){
      var overlay_start = overlay.get('start').index;
      var overlay_end = overlay.get('end').index;
      return overlay_start >= start_index && overlay_end <= end_index;
    })
    deletable_overlays.forEach(function(overlay){
      console.log("remove overlay", overlay.get('start').index, overlay.get('end').index, overlay.get('attribute'));
      overlays.removeValue(overlay);
    })
  }

  function split_or_remove_overlay(start_index, end_index, attribute){
    var found = find_colliding_overlay(overlays, attribute, start_index)
    if (!found) {
      console.log("ANOMALY - deleted overlay that wasn't found")
      return
    }

    var overlay = found.overlay;

    var overlay_start = overlay.get('start')
    var overlay_end = overlay.get('end')

    var matches_start = start_index === overlay_start.index
    var matches_end = end_index === overlay_end.index

    remove_overlay(found.index)
    if (matches_start && matches_end) {
      // remove the whole overlay
      console.log("remove whole overlay", attribute)
    } else if (matches_start) {
      // erase the start of this overlay
      console.log("remove beginning of overlay", attribute)
      create_overlay(end_index, overlay_end.index, attribute)
    } else if (matches_end) {
      // erase the end of this overlay
      console.log("remove end of overlay", attribute)
      create_overlay(overlay_start.index, start_index, attribute)
    } else {
      // split this overlay into two
      console.log("split overlay", attribute)
      create_overlay(overlay_start.index, start_index, attribute) // start half
      create_overlay(end_index, overlay_end.index, attribute); // second half
    }
  }
  
  function extend_or_create_overlay(start_index, end_index, attribute){
    var found_start = find_colliding_overlay(overlays, attribute, start_index-1);
    var found_end = find_colliding_overlay(overlays, attribute, end_index);

    if (found_start && found_end) {
      // contiguous connection between two existing overlays
      console.log("connect two overlays", attribute)
      remove_overlay(found_start.index);
      remove_overlay(found_end.index-1); // previous operation shifts the indexes
      create_overlay(found_start.overlay.get('start').index, found_end.overlay.get('end').index, attribute)
    } else if (found_start) {
      console.log("extend overlay forward", attribute)
      remove_overlay(found_start.index)
      create_overlay(found_start.overlay.get('start').index, end_index, attribute)
      // found_start.overlay.get('end').index = end_index;
    } else if (found_end) {
      console.log("extend overlay backward", attribute)
      remove_overlay(found_end.index)
      create_overlay(start_index, found_end.overlay.get('end').index, attribute)
      // found_end.overlay.get('start').index = start_index;
    } else {
      create_overlay(start_index, end_index, attribute);
      console.log("create new overlay", attribute)
    }
  }

  function formatText(index, length, attributes) {
    var end_index = index + length;
    // iterate through attribute changes
    for (var attribute in attributes) {
      value = attributes[attribute];
      if (value) {
        extend_or_create_overlay(index, end_index, attribute);
      } else {
        split_or_remove_overlay(index, end_index, attribute);
      }
    }
  }

  function insertText(index, text, attributes) {
    str.insertString(index, text);
    formatText(index, index + text.length, attributes);
  }

  function deleteText(index, length) {
    var end_index = index + length;
    delete_overlay_range(index, end_index);
    str.removeRange(text_index, end_index);
  }

  // Hook up callbacks

  function add_format(item) {
    apply_format(item, true);
  }

  function remove_format(item) {
    apply_format(item, false);
  }

  overlays.addEventListener(gapi.drive.realtime.EventType.VALUES_ADDED, function(event){
    // preview
    if (preview_overlay) {
      event.values.forEach(preview_overlay);
    }

    // actually apply event
    if (event.isLocal) return;
    event.values.forEach(add_format)
  });

  overlays.addEventListener(gapi.drive.realtime.EventType.VALUES_REMOVED, function(event){
    if (remove_overlay_preview) {
      event.values.forEach(remove_overlay_preview);
    }

    if (event.isLocal) return;
    event.values.forEach(remove_format)
  });

  str.addEventListener(gapi.drive.realtime.EventType.TEXT_INSERTED, function(event){
    if (event.isLocal) return;
    console.log("INSERTED", event.index, event.text);
    insert_text(event.index, event.text);

  })

  str.addEventListener(gapi.drive.realtime.EventType.TEXT_DELETED, function(event){
    if (event.isLocal) return;
    console.log("DELETED", event.index, event.text);
    delete_text(event.index, event.text);
  })


  // Quill / Outgoing Events

  insert_text(0, str.getText())
  overlays.asArray().forEach(preview_overlay);
  overlays.asArray().forEach(add_format);

  // return interface

  return {
    formatText: formatText,
    insertText: insertText,
    deleteText: deleteText
  }

}