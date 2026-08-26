/* Resuelve la cascada Categoria -> Subcategoria -> Tipificacion con JSON
 * embebido + JS vanilla minimo, como recomienda el plan de reescritura
 * (evita traer un framework de frontend solo para esto). Reutilizado tanto
 * en el formulario de creacion de tickets como en el card de reclasificar
 * del detalle. */
function initTicketCascade(ids, cascade, preselect) {
  var categorySelect = document.getElementById(ids.category);
  var subcategorySelect = document.getElementById(ids.subcategory);
  var typificationSelect = document.getElementById(ids.typification);
  if (!categorySelect || !subcategorySelect || !typificationSelect) return;

  function clearSelect(select, placeholder) {
    select.innerHTML = '';
    var opt = document.createElement('option');
    opt.value = '';
    opt.textContent = placeholder;
    select.appendChild(opt);
  }

  function findCategory() {
    return cascade.find(function (c) { return String(c.id) === categorySelect.value; });
  }

  function findSubcategory(cat) {
    if (!cat) return undefined;
    return cat.subcategories.find(function (s) { return String(s.id) === subcategorySelect.value; });
  }

  function populateCategories(selected) {
    clearSelect(categorySelect, 'Sin clasificar');
    cascade.forEach(function (cat) {
      var opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.name;
      if (selected && String(cat.id) === String(selected)) opt.selected = true;
      categorySelect.appendChild(opt);
    });
  }

  function populateSubcategories(selected) {
    clearSelect(subcategorySelect, '—');
    var cat = findCategory();
    if (!cat) {
      subcategorySelect.disabled = true;
      return;
    }
    subcategorySelect.disabled = false;
    cat.subcategories.forEach(function (sub) {
      var opt = document.createElement('option');
      opt.value = sub.id;
      opt.textContent = sub.name;
      if (selected && String(sub.id) === String(selected)) opt.selected = true;
      subcategorySelect.appendChild(opt);
    });
  }

  function populateTypifications(selected) {
    clearSelect(typificationSelect, '—');
    var sub = findSubcategory(findCategory());
    if (!sub) {
      typificationSelect.disabled = true;
      return;
    }
    typificationSelect.disabled = false;
    sub.typifications.forEach(function (typ) {
      var opt = document.createElement('option');
      opt.value = typ.id;
      opt.textContent = typ.name;
      if (selected && String(typ.id) === String(selected)) opt.selected = true;
      typificationSelect.appendChild(opt);
    });
  }

  categorySelect.addEventListener('change', function () {
    populateSubcategories(null);
    populateTypifications(null);
  });
  subcategorySelect.addEventListener('change', function () {
    populateTypifications(null);
  });

  preselect = preselect || {};
  populateCategories(preselect.category_id);
  populateSubcategories(preselect.subcategory_id);
  populateTypifications(preselect.typification_id);
}
