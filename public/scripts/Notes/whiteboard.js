//---------------------------------whiteboard

function initWhiteboard(block){

  const container = document.getElementById(`canvas_${block.id}`).parentElement;

  const canvas = new fabric.Canvas(`canvas_${block.id}`, {
    selection: true
  });

  canvas.setWidth(container.clientWidth);
  canvas.setHeight(600);

  window[`fabric_${block.id}`] = canvas;

  if(block.content){
    canvas.loadFromJSON(
      JSON.parse(block.content),
      canvas.renderAll.bind(canvas)
    );
  }
}

function enableDraw(blockId){
  const canvas = window[`fabric_${blockId}`];
  canvas.isDrawingMode = true;
}

function addRect(blockId){
  const canvas = window[`fabric_${blockId}`];
  const color = document.getElementById(`color_${blockId}`).value;

  const rect = new fabric.Rect({
    left:100,
    top:100,
    fill: color,
    stroke: color,
    width:120,
    height:70
  });

  canvas.add(rect);
}

function addCircle(blockId){
  const canvas = window[`fabric_${blockId}`];
  const color = document.getElementById(`color_${blockId}`).value;

  const circle = new fabric.Circle({
    left:150,
    top:150,
    radius:50,
    fill: color,
    stroke: color
  });

  canvas.add(circle);
}
function addText(blockId){
  const canvas = window[`fabric_${blockId}`];
  const color = document.getElementById(`color_${blockId}`).value;

  const text = new fabric.IText("Edit me",{
    left:200,
    top:200,
    fill: color
  });

  canvas.add(text);
}
async function saveWhiteboard(blockId){

  const canvas = window[`fabric_${blockId}`];
  const json = JSON.stringify(canvas.toJSON());

  await fetch(`/notes/${currentNoteId}/block/${blockId}/update`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({content:json})
  });

  alert("Whiteboard saved");
}

function setSelect(blockId){
  const canvas = window[`fabric_${blockId}`];
  canvas.isDrawingMode = false;
  canvas.selection = true;
} 

function enableDraw(blockId){
  const canvas = window[`fabric_${blockId}`];
  const color = document.getElementById(`color_${blockId}`).value;

  canvas.isDrawingMode = true;
  canvas.freeDrawingBrush.color = color;
  canvas.freeDrawingBrush.width = 3;
}

function deleteSelected(blockId){
  const canvas = window[`fabric_${blockId}`];
  const active = canvas.getActiveObject();

  if(active){
    canvas.remove(active);
  }
}

function resizeCanvas(blockId, size){
  const canvas = window[`fabric_${blockId}`];

  if(size === "small"){
    canvas.setWidth(600);
    canvas.setHeight(400);
  }

  if(size === "medium"){
    canvas.setWidth(900);
    canvas.setHeight(600);
  }

  if(size === "large"){
    canvas.setWidth(1200);
    canvas.setHeight(800);
  }

  canvas.renderAll();
}

function increaseHeight(blockId){
  const canvas = window[`fabric_${blockId}`];

  const newHeight = canvas.getHeight() + 300;
  canvas.setHeight(newHeight);

  canvas.renderAll();
}

function enableZoom(blockId){
  const canvas = window[`fabric_${blockId}`];

  canvas.on('mouse:wheel', function(opt) {
    const delta = opt.e.deltaY;
    let zoom = canvas.getZoom();
    zoom *= 0.999 ** delta;

    if (zoom > 3) zoom = 3;
    if (zoom < 0.5) zoom = 0.5;

    canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
    opt.e.preventDefault();
    opt.e.stopPropagation();
  });
}

function changeColor(blockId, color){
  const canvas = window[`fabric_${blockId}`];

  // Update drawing brush color
  if(canvas.isDrawingMode){
    canvas.freeDrawingBrush.color = color;
  }

  // Update selected object color (if any)
  const active = canvas.getActiveObject();
  if(active){
    if(active.type === "i-text"){
      active.set("fill", color);
    } else {
      active.set("fill", color);
      active.set("stroke", color);
    }
    canvas.renderAll();
  }
}

function setActiveButton(blockId, type){
  const toolbar = document.querySelector(`#canvas_${blockId}`).closest('.whiteboard-container')
                    .previousElementSibling;

  toolbar.querySelectorAll("button").forEach(btn=>{
    btn.classList.remove("active");
  });

  const btn = toolbar.querySelector(`[data-mode="${type}"]`);
  if(btn) btn.classList.add("active");
}