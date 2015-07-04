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


function get_format_at_index(index) {
  return quill.getContents(index, index+1).ops[0].attributes;
}

function apply_format(value) {
  var start = value.get('start');
  var end = value.get('end');
  var attributes = value.get('attributes');

  quill.formatText(start.index, end.index, attributes)
}

// After a file has been initialized and loaded, we can access the
// document. We will wire up the data model to the UI.
function onFileLoaded(doc) {

  // Drive / Incoming Events

  console.log ("LOADED")
  var model = doc.getModel()
  var root = model.getRoot()

  var string_name = 'demo_string';
  var str = root.get(string_name);
  if (!str) {
    str = model.createString();
    root.set(string_name, str)
  }

  var format_name = 'formats'
  var formats = root.get(format_name);
  if (!formats) {
    formats = model.createList()
    root.set(format_name, formats)
  }

  str.addEventListener(gapi.drive.realtime.EventType.TEXT_INSERTED, function(event){
    if (event.isLocal) return;
    console.log("INSERTED", event.index, event.text);
    var attributes = get_format_at_index(event.index);
    quill.insertText(event.index, event.text, attributes);
  })

  str.addEventListener(gapi.drive.realtime.EventType.TEXT_DELETED, function(event){
    if (event.isLocal) return;
    console.log("DELETED", event.index, event.text);
    quill.deleteText(event.index, event.index+event.text.length)
  })

  formats.addEventListener(gapi.drive.realtime.EventType.VALUES_ADDED, function(event){
    if (event.isLocal) return;
    event.values.forEach(apply_format)
    console.log(event.index, event.values.length, event.values[0].type)
  });


  // Quill / Outgoing Events

  quill.setContents([
    {insert: str.getText()}
  ])

  formats.asArray().forEach(apply_format)

  quill.on('text-change', function(delta, source) {
    if (source == 'user') {
      var text_index = 0;
      var start_index = null;
      for (operation_index in delta.ops) {
        var operation = delta.ops[operation_index];
        console.log(operation.insert, operation.retain, operation.delete)

        if (operation.attributes) {
          var start_index = text_index;
        }

        if (operation.retain) {
          text_index += operation.retain;
        }

        // no need to apply attributes if you have inserted or deleted text --
        // they will already be known by the receiving client
        if (operation.insert) {
          str.insertString(text_index, operation.insert);
          continue;
        }
        if (operation.delete) {
          str.removeRange(text_index, text_index + operation.delete);
          continue;
        }

        if (operation.attributes) {
          var start_ref = str.registerReference(start_index, true);
          var end_ref = str.registerReference(text_index, true);
          console.log(start_ref, end_ref, operation.attributes);
          formats.push(
            model.createMap({
              start: start_ref,
              end: end_ref,
              attributes: operation.attributes
            })
          )
        }
      }
    }
  })
}
