var clientId = '661099579330-dctm6hcm5co8jt8ug7qreu1kfn1t9ru3.apps.googleusercontent.com';
var realtimeUtils = new utils.RealtimeUtils({ clientId: clientId });

var quill = new Quill('#editor');
quill.addModule('toolbar', { container: '#toolbar' });

authorize();

function authorize() {
  // Attempt to authorize
  realtimeUtils.authorize(function(response){
    if(response.error){
      // Authorization failed because this is the first time the user has used your application,
      // show the authorize button to prompt them to authorize manually.
      var button = document.getElementById('auth_button');
      button.classList.add('visible');
      button.addEventListener('click', function () {
        realtimeUtils.authorize(function(response){
          start();
        }, true);
      });
    } else {
        start();
    }
  }, false);
}

function start() {
  // With auth taken care of, load a file, or create one if there
  // is not an id in the URL.
  var id = realtimeUtils.getParam('id');
  if (id) {
    // Load the document id from the URL
    realtimeUtils.load(id.replace('/', ''), onFileLoaded, onFileInitialize);
  } else {
    // Create a new document, add it to the URL
    realtimeUtils.createRealtimeFile('New Quickstart File', function(createResponse) {
      window.history.pushState(null, null, '?id=' + createResponse.id);
      realtimeUtils.load(createResponse.id, onFileLoaded, onFileInitialize);
    });
  }
}

// The first time a file is opened, it must be initialized with the
// document structure. This function will add a collaborative string
// to our model at the root.
function onFileInitialize(model) {
  var string = model.createString();
  string.setText('Welcome to the Quickstart App!');
  model.getRoot().set('demo_string', string);
}


function get_attributes_at_index(index) {
  return quill.getContents(index, index+1).ops[0].attributes;
}

function apply_format(item, value) {
  console.log("APPLY FORMAT", item.get('start').index, item.get('end').index, item.get('attribute'), value)
  quill.formatText(
    item.get('start').index,
    item.get('end').index,
    item.get('attribute'),
    value
  )
}

function add_format(item) {
  apply_format(item, true);
}

function remove_format(item) {
  apply_format(item, false);
}

function move_format(item) {

}


// After a file has been initialized and loaded, we can access the
// document. We will wire up the data model to the UI.
function onFileLoaded(doc) {

  // Drive / Incoming Events

  console.log ("LOADED")
  var model = doc.getModel()
  var root = model.getRoot()

  var string_name = 'text';
  var str = root.get(string_name);
  if (!str) {
    str = model.createString();
    root.set(string_name, str)
  }

  var overlays_name = 'overlays'
  var overlays = root.get(overlays_name);
  if (!overlays) {
    overlays = model.createList()
    root.set(overlays_name, overlays)
  }

  // helper functions

  function create_overlay(start_index, end_index, attribute) {
    console.log('create overlay:', start_index, end_index, attribute)
    var start_ref = str.registerReference(start_index, true);
    var end_ref = str.registerReference(end_index, true);
    overlays.push(
      model.createMap({
        start: start_ref,
        end: end_ref,
        attribute: attribute
      })
    )
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

  function split_or_remove_overlay(start_index, end_index, attribute){
    var found = find_colliding_overlay(overlays, attribute, start_index+1)
    if (!found) {
      throw "ANOMALY: removing overlay that wasn't found"
    }

    var overlay = found.overlay

    var overlay_start = overlay.get('start')
    var overlay_end = overlay.get('end')

    var matches_start = start_index === overlay_start.index
    var matches_end = end_index === overlay_end.index

    console.log("remove overlay", overlay_start.index, overlay_end.index, attribute)
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

    // if (matches_start && matches_end) {
    //   // remove the whole overlay
    //   remove_overlayValue(overlay)
    // } else if (matches_start) {
    //   // erase the start of this overlay
    //   overlay_start.index = end_index;
    // } else if (matches_end) {
    //   // erase the end of this overlay
    //   overlay_end.index = start_index;
    // } else {
    //   // split this overlay into two
    //   var overlay_end_index = overlay_end.index;
    //   overlay_end.index = start_index // first half
    //   create_overlay(str, end_index, overlay_end_index); // second half
    // }
  }
  
  function remove_overlay(index) {
    var overlay = overlays.get(index);
    console.log("remove overlay", overlay.get('start').index, overlay.get('end').index, overlay.get('attribute'));
    overlays.remove(index);
  }

  function extend_or_create_overlay(start_index, end_index, attribute){
    var found_start = find_colliding_overlay(overlays, attribute, start_index-1);
    var found_end = find_colliding_overlay(overlays, attribute, end_index);

    if (found_start && found_end) {
      // contiguous connection between two existing overlays
      remove_overlay(found_start.index);
      remove_overlay(found_end.index);
      create_overlay(found_start.overlay.get('start').index, found_end.overlay.get('end').index, attribute)
      // console.log('remove overlay', found_start.overlay.get('start').index, found_start.overlay.get('end').index, attribute)
      // console.log('remove overlay', found_end.overlay.get('start').index, found_end.overlay.get('end').index, attribute)
      console.log("connect two overlays", attribute)
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

  function modify_overlays(start_index, end_index, attributes) {
    // iterate through attribute changes
    for (var attribute in attributes) {
      value = attributes[attribute];
      if (value) {
        extend_or_create_overlay(start_index, end_index, attribute);
      } else {
        split_or_remove_overlay(start_index, end_index, attribute);
      }
    }
  }



  // Text changes

  str.addEventListener(gapi.drive.realtime.EventType.TEXT_INSERTED, function(event){
    if (event.isLocal) return;
    console.log("INSERTED", event.index, event.text);
    var attributes = get_attributes_at_index(event.index-1);
    quill.insertText(event.index, event.text, attributes);
  })

  str.addEventListener(gapi.drive.realtime.EventType.TEXT_DELETED, function(event){
    if (event.isLocal) return;
    console.log("DELETED", event.index, event.text);
    quill.deleteText(event.index, event.index+event.text.length)
  })

  // Overlay changes

  overlays.addEventListener(gapi.drive.realtime.EventType.VALUES_ADDED, function(event){
    if (event.isLocal) return;
    event.values.forEach(add_format)
    // console.log("OVERLAY ADDED", event.index, event.values.length, event.values[0].type)
  });

  overlays.addEventListener(gapi.drive.realtime.EventType.VALUES_REMOVED, function(event){
    if (event.isLocal) return;
    event.values.forEach(remove_format)
    // console.log(event.index, event.values.length, event.values[0].type)
  });

  // Quill / Outgoing Events

  quill.setContents([
    {insert: str.getText()}
  ])

  overlays.asArray().forEach(add_format)


  quill.on('text-change', function(delta, source) {
    if (source == 'user') {
      var text_index = 0;
      var start_index = null;
      for (operation_index in delta.ops) {
        var operation = delta.ops[operation_index];
        console.log(operation.insert, operation.retain, operation.delete)

        // formatting added via the toolbar
        if (operation.retain) {
          start_index = text_index;
          text_index += operation.retain;
          modify_overlays(start_index, text_index, operation.attributes)
        }

        if (operation.insert) {
          str.insertString(text_index, operation.insert);
          var attributes = get_attributes_at_index(text_index);

          text_index += operation.insert.length;
        }

        if (operation.delete) {
          str.removeRange(text_index, text_index + operation.delete);
          text_index += operation.delete;
        }
      }
    }
  })
}
