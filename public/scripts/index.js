let isAlreadyCalling = false;
let getCalled = false;
const existingCalls = [];
const { RTCPeerConnection, RTCSessionDescription } = window;
const peerConnection = new RTCPeerConnection();
const socket = io("wss://web-chat-uoni.onrender.com");
const messageInput = document.getElementById('message-input');
const sendMessageBtn = document.getElementById('send-message');
const messagesList = document.getElementById('messages');
const usersList = document.getElementById('users-list');
const retrievedDetails = JSON.parse(localStorage.getItem('firebaseui::rememberedAccounts'));
const username = retrievedDetails[0]['displayName'];
const email = retrievedDetails[0]['email'];
const photo = retrievedDetails[0]['photoUrl'];
socket.emit('join-chat', username, email, photo);
socket.on('chat message', (data) => {
    const newMessage = document.createElement('li');
    newMessage.textContent = `${data.username}: ${data.msg}`;
    messagesList.appendChild(newMessage);
});
socket.on('users-list', (userList) => {
    usersList.innerHTML = '';
    userList.forEach(user => {
        const userItem = document.createElement('li');
        userItem.textContent = user.name;
        usersList.appendChild(userItem);
    });
});
sendMessageBtn.addEventListener('click', () => {
    const message = messageInput.value;
    if (message.trim()) {
        socket.emit('chat message', message);
        messageInput.value = '';
    }
});
function unselectUsersFromList() {
    const alreadySelectedUser = document.querySelectorAll(
        ".active-user.active-user--selected"
    );
    alreadySelectedUser.forEach(el => {
        el.setAttribute("class", "active-user");
    });
}
function createUserItemContainer(socketId, userDetails) {
    const userContainerEl = document.createElement("div");
    userContainerEl.classList.add("user-card");
    const profilePictureEl = document.createElement("div");
    profilePictureEl.classList.add("profile-picture");
    profilePictureEl.style.backgroundImage = `url('${userDetails.photo}')`;
    const userDetailsEl = document.createElement("div");
    userDetailsEl.classList.add("user-details");
    const nameEl = document.createElement("h2");
    nameEl.classList.add("name");
    nameEl.textContent = userDetails.name;
    const emailEl = document.createElement("p");
    emailEl.classList.add("email");
    emailEl.textContent = userDetails.email;
    userContainerEl.setAttribute("class", "active-user");
    userContainerEl.setAttribute("id", socketId);
    userDetailsEl.appendChild(nameEl);
    userDetailsEl.appendChild(emailEl);
    userContainerEl.appendChild(profilePictureEl);
    userContainerEl.appendChild(userDetailsEl);
    userContainerEl.addEventListener("click", () => {
        unselectUsersFromList();
        userContainerEl.setAttribute("class", "active-user active-user--selected");
        const talkingWithInfo = document.getElementById("talking-with-info");
        talkingWithInfo.innerHTML = `Talking with: "User: ${userDetails.name}"`;
        callUser(socketId);
    });
    return userContainerEl;
}

async function callUser(socketId) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(new RTCSessionDescription(offer));
    socket.emit("call-user", {
        offer,
        to: socketId
    });
}

function updateUserList(socketIds, userDetails) {
    const activeUserContainer = document.getElementById("active-user-container");
    socketIds.forEach(socketId => {
        const alreadyExistingUser = document.getElementById(socketId);
        if (!alreadyExistingUser) {
            const userContainerEl = createUserItemContainer(socketId, userDetails[socketId]);

            activeUserContainer.appendChild(userContainerEl);
        } else {
            console.log("User already exist")
        }
    });
}

socket.on("update-user-list", ({ users, userDetails }) => {
    updateUserList(users, userDetails);
});

socket.on("remove-user", ({ socketId }) => {
    const elToRemove = document.getElementById(socketId);
    if (elToRemove) {
        elToRemove.remove();
    }
});

socket.on("call-made", async data => {
    if (getCalled) {
        const confirmed = confirm(
            `${data.userdata['name']} wants to call you. Do accept this call?`
        );
        if (!confirmed) {
            socket.emit("reject-call", {
                from: data.socket
            });
            return;
        }
    }
    await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.offer)
    );
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(new RTCSessionDescription(answer));

    socket.emit("make-answer", {
        answer,
        to: data.socket
    });
    getCalled = true;
});
socket.on("answer-made", async data => {
    await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.answer)
    );
    if (!isAlreadyCalling) {
        callUser(data.socket);
        isAlreadyCalling = true;
    }
});
socket.on("call-rejected", data => {
    alert(`${data.userdata['name']} rejected your call.`);
    unselectUsersFromList();
});
peerConnection.ontrack = function ({ streams: [stream] }) {
    const remoteVideo = document.getElementById("remote-video");
    if (remoteVideo) {
        remoteVideo.srcObject = stream;
    }
};
navigator.getUserMedia(
    { video: true, audio: true },
    stream => {
        const localVideo = document.getElementById("local-video");
        if (localVideo) {
            localVideo.srcObject = stream;
        }
        stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
    },
    error => {
        console.warn(error.message);
    }
);
const inputField = document.getElementById('message-input');
const submitButton = document.getElementById('send-message');
inputField.addEventListener('keypress', function (event) {
    // Check if the pressed key is Enter key (key code 13)
    if (event.keyCode === 13 || event.which === 13) {
        // Prevent the default action of the Enter key (e.g., form submission)
        event.preventDefault();
        // Programmatically trigger a click event on the submit button
        submitButton.click();
    }
});

function toggleMenu() {
    var menu = document.querySelector('.active-users-panel');
    menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
}

function toggleChat() {
    var menu = document.querySelector('.chat-panel');
    menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
}
