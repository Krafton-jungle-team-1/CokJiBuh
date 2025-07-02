const emojiButton = document.querySelector('#emojiInsert > #emoji-btn');
const picker = new EmojiButton({
    zIndex: '9999999',
});
emojiButton.addEventListener('click', () => {
    picker.togglePicker(emojiButton);
});
picker.on('emoji', emoji => {
    const emojiInput = document.querySelector('#newPinEmoji');
    emojiInput.value = emoji;
    console.log('EmojiButton:', typeof EmojiButton);
})

const emojiButton_2 = document.querySelector('#emojiInsert_2 > #emoji-btn');
 emojiButton_2.addEventListener('click', () => {
      picker.togglePicker(emojiButton_2);
});
  picker.on('emoji', emoji => {
    const editPinEmoji = document.querySelector('#editPinEmoji');
    editPinEmoji.value = emoji;
    console.log('EmojiButton:', typeof EmojiButton);
})
