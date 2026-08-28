/* Permite pegar (Ctrl+V) una captura de pantalla mientras se escribe en un
 * campo de texto (Descripción al crear un ticket, Comentario en el
 * detalle), en vez de tener que guardarla primero y elegirla a mano en
 * "Adjuntar archivo".
 *
 * El listener se ata al TEXTAREA, no al input de archivo: el navegador
 * solo entrega clipboardData real en un evento "paste" cuando el
 * elemento con el foco es editable (input, textarea, contenteditable) —
 * un textarea de descripción/comentario ya recibe el foco de forma
 * natural en cuanto el usuario empieza a escribir ahí, así que no hace
 * falta ningún truco de auto-enfoque (a diferencia de intentarlo
 * directo sobre el input de archivo, que además abriría el diálogo
 * nativo si se le hace clic).
 *
 * El campo de "Adjuntar archivo" en sí NO cambia de comportamiento: solo
 * se usa como destino, poblado vía DataTransfer con la imagen pegada,
 * igual que si el usuario la hubiera elegido a mano con "Elegir
 * archivo". */
function initPasteAttach(textareaId, fileInputId, statusId, nextStepHint) {
  var textarea = document.getElementById(textareaId);
  var fileInput = document.getElementById(fileInputId);
  if (!textarea || !fileInput) return;

  textarea.addEventListener('paste', function (event) {
    var clipboardData = event.clipboardData || window.clipboardData;
    var items = clipboardData && clipboardData.items;
    if (!items) return;

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (item.type.indexOf('image') === -1) continue;

      var blob = item.getAsFile();
      var ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      var file = new File([blob], 'captura-' + Date.now() + '.' + ext, { type: blob.type });

      var dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));

      var status = document.getElementById(statusId);
      if (status) {
        status.textContent = 'Imagen pegada: ' + file.name + (nextStepHint ? ' — ' + nextStepHint : '');
        status.style.color = 'var(--color-success)';
      }

      event.preventDefault();
      break;
    }
  });
}
