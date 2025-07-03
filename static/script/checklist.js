const checklistBtn = document.getElementById('checklistBtn');
const checklist = document.getElementById('checklist');
// const addChecklistBtn = document.querySelector('#addChecklistBtn');
const checklistContent = document.getElementById('checklistContent');
const checklistForm = document.querySelector('#checklistHeader form');
const checklistInput = document.querySelector('#checklistInput');
let checklistItems = [];

checklistBtn.addEventListener('click', () => {
    if(checklist.style.display === 'none')
        checklist.style.display = 'flex';
    else checklist.style.display = 'none';
});

checklistForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newChecklistItem = {
        text: checklistInput.value,
        id: Date.now(),
    };
    checklistItems.push(newChecklistItem);
    localStorage.setItem('checklist', JSON.stringify(checklistItems));
    console.log(localStorage.getItem('checklist'));
    paintCheckList(newChecklistItem);
    checklistInput.value = ''; 
})

function paintCheckList(item){
    const ChecklistItem = document.createElement('div');
    ChecklistItem.classList.add('checklistItem');
    ChecklistItem.id = item.id;
    const span = document.createElement('span');
    span.innerText = item.text;
    const button = document.createElement('button');
    button.id = item.id;
    button.innerHTML = '&times;';
    button.classList.add('deleteChecklistBtn');
    button.addEventListener('click', deleteChecklist);
    ChecklistItem.appendChild(span);
    ChecklistItem.appendChild(button);
    checklistContent.appendChild(ChecklistItem);
}

export function loadCheckList(){
    checklistContent.innerHTML = '';
    const storedChecklist = JSON.parse(localStorage.getItem('checklist'));
    checklistItems = storedChecklist;
    console.log(storedChecklist);
    if(storedChecklist) {
        storedChecklist.forEach(item => {
            paintCheckList(item);
        })
    }
}

function deleteChecklist(e){
    const item = e.target.parentElement;
    checklistItems = checklistItems.filter(checkItem=> checkItem.id !== parseInt(item.id));
    localStorage.setItem('checklist', JSON.stringify(checklistItems));
    item.remove();
}