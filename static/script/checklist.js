const checklistBtn = document.getElementById('checklistBtn');
const checklist = document.getElementById('checklist');
const addChecklistBtn = document.querySelector('#addChecklistBtn');
const checklistContent = document.getElementById('checklistContent');

checklistBtn.addEventListener('click', () => {
    if(checklist.style.display === 'none')
        checklist.style.display = 'flex';
    else checklist.style.display = 'none';
});

addChecklistBtn.addEventListener('click', () => {
    
})