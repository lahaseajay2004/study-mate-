// ========= TABLE BLOCK =========
async function updateTableCell(blockId, row, col, value){

  await fetch(`/notes/${currentNoteId}/block/${blockId}/table/update-cell`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ row, col, value })
  });
}

async function addTableRow(blockId){

  await fetch(`/notes/${currentNoteId}/block/${blockId}/table/add-row`,{
    method:"POST"
  });

  loadNote(currentNoteId);
}

async function addTableColumn(blockId){

  await fetch(`/notes/${currentNoteId}/block/${blockId}/table/add-col`,{
    method:"POST"
  });
}


