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
    realtimeUtils.load(id.replace('/', ''), onFileLoaded);
  } else {
    // Create a new document, add it to the URL
    realtimeUtils.createRealtimeFile('New Quickstart File', function(createResponse) {
      window.history.pushState(null, null, '?id=' + createResponse.id);
      realtimeUtils.load(createResponse.id, onFileLoaded);
    });
  }
}

function get_attributes_at_index(index) {
  if (index == 0) return null
  return quill.getContents(index-1, index).ops[0].attributes;
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

function insert_text(index, text) {
  var attributes = get_attributes_at_index(index);
  quill.insertText(index, text, attributes);
}

function delete_text(index, text) {
  quill.deleteText(index, index + text.length)
}


// After a file has been initialized and loaded, we can access the
// document. We will wire up the data model to the UI.
function onFileLoaded(doc) {


  // Overlay preview

  function preview_overlay(item) {
    var node = render_overlay(item);
    $('#overlays tbody').append(node);
    item.get('start').addEventListener(gapi.drive.realtime.EventType.REFERENCE_SHIFTED, function(event){
      node.find('.start').text(event.newIndex);
    })
    item.get('end').addEventListener(gapi.drive.realtime.EventType.REFERENCE_SHIFTED, function(event){
      node.find('.end').text(event.newIndex);
    })
  }

  function render_overlay(item) {
    console.log('previewing ', item.get('id'))
    return $('<tr id="overlay-'+item.get('id')+'">'+
      '<td class="attribute">'+item.get('attribute')+'</td>'+
      '<td class="start">'+item.get('start').index+'</td>'+
      '<td class="end">'+item.get('end').index+'</td>'+
      '<td class="id">'+item.get('id')+'</td>'+      
      '</tr>')
  }

  function remove_overlay_preview(item) {
    console.log("unpreviewing ", item.get('id'))
    $('#overlays tbody #overlay-'+item.get('id')).remove()
  }

  function find_attribute_changes(old_attributes, new_attributes) {
    var attributes = {}

    // find added attributes
    for (var attribute in new_attributes) {
      if (!(old_attributes && attribute in old_attributes)) {
        attributes[attribute] = new_attributes[attribute];
      }
    }

    // find removed attributes
    for (var attribute in old_attributes) {
      if (!(new_attributes && attribute in new_attributes)) {
        attributes[attribute] = null;
      }
    }
    return attributes;
   }

  console.log ("LOADED")
  var model = doc.getModel()
  var root = model.getRoot()
  var richtext = new CollaborativeRichText(model, root, 'richtext', insert_text, delete_text, apply_format, preview_overlay, remove_overlay_preview)

  quill.on('text-change', function(delta, source) {
    if (source == 'user') {
      var text_index = 0;
      var new_text_index = null;
      for (operation_index in delta.ops) {
        var operation = delta.ops[operation_index];
        console.log(operation.insert, operation.retain, operation.delete)

        // formatting added via the toolbar
        if (operation.retain) {
          richtext.formatText(text_index, operation.retain, operation.attributes)
          text_index += operation.retain;
        }

        if (operation.insert) {
          console.log('insert...', operation.insert)
          var attributes = find_attribute_changes(get_attributes_at_index(text_index), operation.attributes)
          richtext.insertText(text_index, operation.insert, attributes);
          text_index += operation.insert.length;
        }

        if (operation.delete) {
          console.log('delete...', operation.delete)
          richtext.deleteText(text_index, operation.delete)
          text_index += operation.delete;
        }
      }
    }
  })
}
