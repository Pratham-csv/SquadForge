import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import styled from "styled-components";
import axios from "axios";
import { io } from "socket.io-client";
import {
  host,
  getProjectRoute,
  getMessagesRoute,
  addMessageRoute,
} from "../utils/APIRoutes";

function ProjectRoom() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const socket = useRef();
  const bottomRef = useRef();

  const [user, setUser] = useState(undefined);
  const [project, setProject] = useState(undefined);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  useEffect(() => {
    const savedUser = localStorage.getItem(
      process.env.REACT_APP_LOCALHOST_KEY
    );
    if (!savedUser) {
      navigate("/login");
      return;
    }
    setUser(JSON.parse(savedUser));
  }, [navigate]);

  useEffect(() => {
    if (!user) return;

    async function load() {
      const projectRes = await axios.get(
        `${getProjectRoute}/${projectId}/${user._id}`
      );
      if (!projectRes.data.status) {
        navigate("/");
        return;
      }
      setProject(projectRes.data.project);

      const msgRes = await axios.get(
        `${getMessagesRoute}/${projectId}/${user._id}`
      );
      if (msgRes.data.status) {
        setMessages(msgRes.data.messages);
      }
    }

    load();
  }, [user, projectId, navigate]);

  useEffect(() => {
    if (!user || !projectId) return;

    socket.current = io(host);
    socket.current.emit("join-project", projectId);

    socket.current.on("receive-project-msg", (message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      if (socket.current) {
        socket.current.disconnect();
      }
    };
  }, [user, projectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(event) {
    event.preventDefault();
    if (!text.trim()) return;

    const { data } = await axios.post(addMessageRoute, {
      projectId,
      userId: user._id,
      text,
    });

    if (!data.status) return;

    setMessages((prev) => [...prev, data.message]);
    socket.current.emit("send-project-msg", {
      projectId,
      message: data.message,
    });
    setText("");
  }

  if (!user || !project) {
    return null;
  }

  return (
    <Container>
      <header>
        <div>
          <button className="back" onClick={() => navigate("/")}>
            ← Back
          </button>
          <h1>{project.name}</h1>
          <p>Code: {project.inviteCode}</p>
        </div>
      </header>

      <div className="chat">
        {messages.map((msg) => {
          const mine = msg.sender._id === user._id;
          return (
            <div key={msg._id} className={`bubble ${mine ? "mine" : "other"}`}>
              {!mine && <span className="name">{msg.sender.username}</span>}
              <p>{msg.text}</p>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend}>
        <input
          placeholder="Message your squad..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit">Send</button>
      </form>
    </Container>
  );
}

const Container = styled.div`
  height: 100vh;
  background: #0a0a0b;
  color: #f4f4f5;
  display: flex;
  flex-direction: column;

  header {
    padding: 1rem 1.2rem;
    border-bottom: 1px solid #2a2a2e;
    background: #121214;

    h1 {
      margin: 0.4rem 0 0.2rem;
      color: #c8ff3d;
      font-size: 1.3rem;
    }

    p {
      margin: 0;
      color: #8b8b93;
      font-size: 0.85rem;
    }
  }

  .back {
    background: transparent;
    border: 1px solid #2a2a2e;
    color: #f4f4f5;
    border-radius: 8px;
    padding: 0.35rem 0.7rem;
    cursor: pointer;
  }

  .chat {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }

  .bubble {
    max-width: 70%;
    padding: 0.7rem 0.9rem;
    border-radius: 12px;

    p {
      margin: 0;
      word-break: break-word;
    }

    .name {
      display: block;
      font-size: 0.75rem;
      color: #c8ff3d;
      margin-bottom: 0.25rem;
    }
  }

  .mine {
    align-self: flex-end;
    background: #c8ff3d;
    color: #0a0a0b;
  }

  .other {
    align-self: flex-start;
    background: #1a1a1e;
    border: 1px solid #2a2a2e;
  }

  form {
    display: flex;
    gap: 0.6rem;
    padding: 1rem;
    border-top: 1px solid #2a2a2e;
    background: #121214;
  }

  input {
    flex: 1;
    background: #0a0a0b;
    border: 1px solid #2a2a2e;
    border-radius: 10px;
    padding: 0.8rem;
    color: #f4f4f5;
    outline: none;

    &:focus {
      border-color: #c8ff3d;
    }
  }

  button[type="submit"] {
    background: #c8ff3d;
    color: #0a0a0b;
    border: none;
    border-radius: 10px;
    padding: 0.8rem 1.2rem;
    font-weight: 700;
    cursor: pointer;
  }
`;

export default ProjectRoom;
