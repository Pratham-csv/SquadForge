import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import styled from "styled-components";
import { io } from "socket.io-client";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  host,
  getProjectRoute,
  getMessagesRoute,
  addMessageRoute,
  busiestWindowRoute,
  createPollRoute,
  getPollsRoute,
  votePollRoute,
  closePollRoute,
  promoteMemberRoute,
  askAiRoute,
} from "../utils/APIRoutes";
import api from "../utils/api";
import { getUser } from "../utils/authStorage";

function ProjectRoom() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const socket = useRef();
  const bottomRef = useRef();

  const [user, setUser] = useState(undefined);
  const [project, setProject] = useState(undefined);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [tab, setTab] = useState("chat");
  const [polls, setPolls] = useState([]);
  const [myRole, setMyRole] = useState("member");
  const [question, setQuestion] = useState("");
  const [option1, setOption1] = useState("");
  const [option2, setOption2] = useState("");
  const [option3, setOption3] = useState("");
  const [aiMode, setAiMode] = useState("markers");
  const [startMessageId, setStartMessageId] = useState("");
  const [endMessageId, setEndMessageId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState("");
  const [busyWindow, setBusyWindow] = useState(null); // sliding-window highlight
  const [busyMinutes, setBusyMinutes] = useState(30);
  const chatInputRef = useRef(null);
  const skipAutoScrollRef = useRef(false);

  const toastOptions = {
    position: "bottom-right",
    autoClose: 3000,
    theme: "dark",
  };

  useEffect(() => {
    const parsed = getUser();
    if (!parsed) {
      navigate("/login");
      return;
    }
    if (!parsed.isAvatarImageSet) {
      navigate("/setAvatar");
      return;
    }
    setUser(parsed);
  }, [navigate]);

  async function loadProjectAndChat() {
    const projectRes = await api.get(
      `${getProjectRoute}/${projectId}/${user._id}`
    );
    if (!projectRes.data.status) {
      navigate("/");
      return;
    }
    setProject(projectRes.data.project);

    const member = projectRes.data.project.members.find(
      (m) => m.user._id === user._id || m.user === user._id
    );
    if (member) {
      setMyRole(member.role);
    }

    const msgRes = await api.get(
      `${getMessagesRoute}/${projectId}/${user._id}`
    );
    if (msgRes.data.status) {
      setMessages(msgRes.data.messages);
    }
  }

  async function loadPolls() {
    const { data } = await api.get(
      `${getPollsRoute}/${projectId}/${user._id}`
    );
    if (data.status) {
      setPolls(data.polls);
      setMyRole(data.myRole);
    }
  }

  useEffect(() => {
    if (!user) return;
    loadProjectAndChat();
  }, [user, projectId, navigate]);

  useEffect(() => {
    if (!user || tab !== "polls") return;
    loadPolls();
  }, [user, tab, projectId]);

  useEffect(() => {
    if (!user || !projectId) return;

    socket.current = io(host);
    socket.current.emit("join-project", projectId);

    socket.current.on("receive-project-msg", (message) => {
      setMessages((prev) => {
        if (prev.some((m) => m._id === message._id)) return prev;
        return [...prev, message];
      });
    });

    return () => {
      if (socket.current) {
        socket.current.disconnect();
      }
    };
  }, [user, projectId]);

  useEffect(() => {
    if (skipAutoScrollRef.current) {
      skipAutoScrollRef.current = false;
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function isInBusyStretch(msgId) {
    if (!busyWindow) return false;
    const startIdx = messages.findIndex(
      (m) => String(m._id) === String(busyWindow.startMessageId)
    );
    const endIdx = messages.findIndex(
      (m) => String(m._id) === String(busyWindow.endMessageId)
    );
    const idx = messages.findIndex((m) => String(m._id) === String(msgId));
    if (startIdx < 0 || endIdx < 0 || idx < 0) return false;
    return idx >= startIdx && idx <= endIdx;
  }

  async function handleFindBusiest() {
    const { data } = await api.get(
      `${busiestWindowRoute}/${projectId}?windowMinutes=${busyMinutes}`
    );

    if (!data.status) {
      toast.error(data.msg || "Could not find busiest stretch", toastOptions);
      return;
    }

    setBusyWindow(data.window);
    skipAutoScrollRef.current = true;

    // Scroll to the start of the highlighted stretch after paint
    setTimeout(() => {
      const el = document.querySelector(
        `[data-msgid="${data.window.startMessageId}"]`
      );
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);

    toast.success("Highlighted the busiest stretch in this chat", toastOptions);
  }

  function clearBusyStretch() {
    setBusyWindow(null);
  }

  function useBusyForAi() {
    if (!busyWindow) return;
    setStartMessageId(busyWindow.startMessageId);
    setEndMessageId(busyWindow.endMessageId);
    setAiMode("markers");
    toast.success("Busiest stretch set as AI Start–End", toastOptions);
  }

  async function handleSend(event) {
    event.preventDefault();
    if (!text.trim()) return;

    const { data } = await api.post(addMessageRoute, {
      projectId,
      text,
    });

    if (!data.status) return;

    // Optimistic add; socket/pubsub may also deliver — dedupe by _id above
    setMessages((prev) => {
      if (prev.some((m) => m._id === data.message._id)) return prev;
      return [...prev, data.message];
    });
    setText("");
    if (chatInputRef.current) {
      chatInputRef.current.style.height = "44px";
    }
  }

  function handleChatInputChange(event) {
    setText(event.target.value);
    const el = event.target;
    el.style.height = "44px";
    const next = Math.min(el.scrollHeight, 140);
    el.style.height = `${next}px`;
  }

  function markStart(messageId) {
    setStartMessageId(messageId);
    setAiMode("markers");
    setOpenMenuId("");
    toast.success("Marked as AI start", toastOptions);
  }

  function markEnd(messageId) {
    setEndMessageId(messageId);
    setAiMode("markers");
    setOpenMenuId("");
    toast.success("Marked as AI end", toastOptions);
  }

  function clearMarks() {
    setStartMessageId("");
    setEndMessageId("");
    setOpenMenuId("");
  }

  function getPreview(messageId) {
    const msg = messages.find((m) => m._id === messageId);
    if (!msg) return "";
    return msg.text.length > 40 ? msg.text.slice(0, 40) + "..." : msg.text;
  }

  async function handleCreatePoll(event) {
    event.preventDefault();

    const options = [option1, option2, option3].filter((o) => o.trim());
    const { data } = await api.post(createPollRoute, {
      projectId,
      question,
      options,
    });

    if (!data.status) {
      toast.error(data.msg, toastOptions);
      return;
    }

    toast.success("Poll created", toastOptions);
    setQuestion("");
    setOption1("");
    setOption2("");
    setOption3("");
    loadPolls();
  }

  async function handleVote(pollId, optionId) {
    const { data } = await api.post(votePollRoute, {
      pollId,
      optionId,
    });

    if (!data.status) {
      toast.error(data.msg, toastOptions);
      return;
    }

    setPolls((prev) =>
      prev.map((p) => (p._id === data.poll._id ? data.poll : p))
    );
  }

  async function handleClose(pollId) {
    const { data } = await api.post(closePollRoute, {
      pollId,
    });

    if (!data.status) {
      toast.error(data.msg, toastOptions);
      return;
    }

    setPolls((prev) =>
      prev.map((p) => (p._id === data.poll._id ? data.poll : p))
    );
  }

  async function handlePromote(memberId) {
    const { data } = await api.post(promoteMemberRoute, {
      projectId,
      memberId,
    });

    if (!data.status) {
      toast.error(data.msg, toastOptions);
      return;
    }

    toast.success(data.msg, toastOptions);
    setProject(data.project);
  }

  function hasVoted(poll) {
    return poll.options.some((opt) =>
      opt.votes.some((v) => v === user._id || v._id === user._id)
    );
  }

  async function handleAskAi(event) {
    event.preventDefault();
    setAiAnswer("");
    setAiLoading(true);

    const body = {
      projectId,
      question: aiQuestion,
    };

    if (aiMode === "markers") {
      body.startMessageId = startMessageId;
      body.endMessageId = endMessageId;
    } else {
      body.fromDate = fromDate;
      body.toDate = toDate;
    }

    try {
      const { data } = await api.post(askAiRoute, body);
      if (!data.status) {
        toast.error(data.msg, toastOptions);
        setAiLoading(false);
        return;
      }
      setAiAnswer(data.answer);
      if (data.source === "local-fallback") {
        toast.info("AI provider unavailable — used local catch-up", toastOptions);
      } else if (data.source === "groq") {
        toast.success(`Groq answered using ${data.usedMessages} messages`, toastOptions);
      } else {
        toast.success(`Used ${data.usedMessages} messages as context`, toastOptions);
      }
    } catch (err) {
      toast.error("AI request failed", toastOptions);
    }

    setAiLoading(false);
  }

  if (!user || !project) {
    return null;
  }

  const canManage = myRole === "owner" || myRole === "manager";
  const isOwner = project.owner === user._id || project.owner?._id === user._id;

  return (
    <Container>
      <header>
        <div>
          <button className="back" onClick={() => navigate("/")}>
            ← Back
          </button>
          <h1>{project.name}</h1>
          <p>
            Code <span className="code">{project.inviteCode}</span> · Role{" "}
            <span className="role">{myRole || "member"}</span>
          </p>
        </div>
        <div className="tabs">
          <button
            className={tab === "chat" ? "active" : ""}
            onClick={() => setTab("chat")}
          >
            Chat
          </button>
          <button
            className={tab === "polls" ? "active" : ""}
            onClick={() => setTab("polls")}
          >
            Polls
          </button>
          <button
            className={tab === "ai" ? "active" : ""}
            onClick={() => setTab("ai")}
          >
            Ask AI
          </button>
        </div>
      </header>

      {tab === "chat" && (
        <>
          <div className="algo-bar">
            <div className="algo-left">
              <select
                value={busyMinutes}
                onChange={(e) => setBusyMinutes(Number(e.target.value))}
                aria-label="Window minutes"
              >
                <option value={15}>15 min window</option>
                <option value={30}>30 min window</option>
                <option value={60}>60 min window</option>
              </select>
              <button type="button" onClick={handleFindBusiest}>
                Find busiest stretch
              </button>
            </div>
          </div>

          {busyWindow && (
            <div className="range-bar busy-bar">
              <div>
                <p>
                  <strong>Busiest stretch</strong> is highlighted below
                </p>
              </div>
              <div className="range-actions">
                <button type="button" onClick={useBusyForAi}>
                  Use for Ask AI
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={clearBusyStretch}
                >
                  Clear highlight
                </button>
              </div>
            </div>
          )}

          {(startMessageId || endMessageId) && (
            <div className="range-bar">
              <div>
                <p>
                  AI Start: {startMessageId ? getPreview(startMessageId) : "—"}
                </p>
                <p>
                  AI End: {endMessageId ? getPreview(endMessageId) : "—"}
                </p>
              </div>
              <div className="range-actions">
                <button type="button" onClick={() => setTab("ai")}>
                  Ask AI
                </button>
                <button type="button" className="ghost" onClick={clearMarks}>
                  Clear
                </button>
              </div>
            </div>
          )}

          <div className="chat">
            {messages.map((msg) => {
              const mine =
                String(msg.sender._id || msg.sender) === String(user._id);
              const isStart =
                String(startMessageId) === String(msg._id) && !!startMessageId;
              const isEnd =
                String(endMessageId) === String(msg._id) && !!endMessageId;
              const inBusy = isInBusyStretch(msg._id);

              return (
                <div
                  key={msg._id}
                  data-msgid={msg._id}
                  className={`msg-row ${mine ? "right" : "left"} ${
                    inBusy ? "busy-hit" : ""
                  }`}
                >
                  {!mine && (
                    <img
                      className="chat-avatar"
                      src={
                        msg.sender.avatarImage
                          ? `data:image/svg+xml;base64,${msg.sender.avatarImage}`
                          : `https://api.dicebear.com/9.x/avataaars/svg?seed=${msg.sender.username}`
                      }
                      alt={msg.sender.username}
                    />
                  )}
                  <div
                    className={`bubble ${mine ? "mine" : "other"} ${
                      isStart || isEnd ? "marked" : ""
                    } ${inBusy ? "busy-glow" : ""}`}
                  >
                    {!mine && (
                      <span className="name">{msg.sender.username}</span>
                    )}
                    {inBusy && <span className="busy-tag">Peak</span>}
                    {(isStart || isEnd) && (
                      <span className="mark-tag">
                        {isStart && isEnd
                          ? "START & END"
                          : isStart
                          ? "START"
                          : "END"}
                      </span>
                    )}
                    <p>{msg.text}</p>
                  </div>

                  {mine && (
                    <img
                      className="chat-avatar"
                      src={
                        user.avatarImage
                          ? `data:image/svg+xml;base64,${user.avatarImage}`
                          : `https://api.dicebear.com/9.x/avataaars/svg?seed=${user.username}`
                      }
                      alt={user.username}
                    />
                  )}

                  <div className="msg-menu">
                    <button
                      type="button"
                      className="menu-btn"
                      onClick={() =>
                        setOpenMenuId(openMenuId === msg._id ? "" : msg._id)
                      }
                    >
                      ▾
                    </button>
                    {openMenuId === msg._id && (
                      <div className="menu-dropdown">
                        <button type="button" onClick={() => markStart(msg._id)}>
                          Mark as Start
                        </button>
                        <button type="button" onClick={() => markEnd(msg._id)}>
                          Mark as End
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <form className="composer" onSubmit={handleSend}>
            <textarea
              ref={chatInputRef}
              placeholder="Message your squad..."
              value={text}
              onChange={handleChatInputChange}
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
            />
            <button type="submit">Send</button>
          </form>
        </>
      )}

      {tab === "polls" && (
        <div className="polls">
          {isOwner && (
            <section className="panel">
              <h2>Members</h2>
              {project.members.map((m) => (
                <div className="member-row" key={m.user._id}>
                  <span>
                    {m.user.username} · {m.role}
                  </span>
                  {m.role === "member" && (
                    <button onClick={() => handlePromote(m.user._id)}>
                      Make Manager
                    </button>
                  )}
                </div>
              ))}
            </section>
          )}

          {canManage && (
            <section className="panel">
              <h2>Create Poll</h2>
              <form onSubmit={handleCreatePoll}>
                <input
                  placeholder="Decision question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
                <input
                  placeholder="Option 1"
                  value={option1}
                  onChange={(e) => setOption1(e.target.value)}
                />
                <input
                  placeholder="Option 2"
                  value={option2}
                  onChange={(e) => setOption2(e.target.value)}
                />
                <input
                  placeholder="Option 3 (optional)"
                  value={option3}
                  onChange={(e) => setOption3(e.target.value)}
                />
                <button type="submit">Create Poll</button>
              </form>
            </section>
          )}

          {!canManage && (
            <p className="hint">Only owner/manager can create polls. You can vote.</p>
          )}

          <section className="panel">
            <h2>Project Polls</h2>
            {polls.length === 0 && <p className="hint">No polls yet.</p>}
            {polls.map((poll) => {
              const totalVotes = poll.options.reduce(
                (sum, opt) => sum + opt.votes.length,
                0
              );
              const voted = hasVoted(poll);

              return (
                <div className="poll-card" key={poll._id}>
                  <div className="poll-top">
                    <h3>{poll.question}</h3>
                    <span>{poll.isOpen ? "Open" : "Closed"}</span>
                  </div>
                  <p className="by">
                    by {poll.createdBy?.username || "unknown"}
                  </p>

                  {poll.options.map((opt) => {
                    const count = opt.votes.length;
                    const percent =
                      totalVotes === 0
                        ? 0
                        : Math.round((count / totalVotes) * 100);

                    return (
                      <div className="option" key={opt._id}>
                        <div className="option-row">
                          <span>
                            {opt.text} ({count}) · {percent}%
                          </span>
                          {poll.isOpen && !voted && (
                            <button onClick={() => handleVote(poll._id, opt._id)}>
                              Vote
                            </button>
                          )}
                        </div>
                        <div className="bar">
                          <div style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}

                  {canManage && poll.isOpen && (
                    <button
                      className="close-btn"
                      onClick={() => handleClose(poll._id)}
                    >
                      Close Poll
                    </button>
                  )}
                </div>
              );
            })}
          </section>
        </div>
      )}

      {tab === "ai" && (
        <div className="polls">
          <section className="panel">
            <h2>Ask AI about chat</h2>
            <p className="hint">
              In Chat, use ▾ on a message → Mark as Start, then Mark as End on a
              later message. Or use date range below.
            </p>

            <div className="mode-row">
              <button
                type="button"
                className={aiMode === "markers" ? "active-mode" : ""}
                onClick={() => setAiMode("markers")}
              >
                Message marks
              </button>
              <button
                type="button"
                className={aiMode === "dates" ? "active-mode" : ""}
                onClick={() => setAiMode("dates")}
              >
                Date range
              </button>
            </div>

            {aiMode === "markers" && (
              <div className="selected-box">
                <p>
                  <strong>Start:</strong>{" "}
                  {startMessageId ? getPreview(startMessageId) : "Not marked yet"}
                </p>
                <p>
                  <strong>End:</strong>{" "}
                  {endMessageId ? getPreview(endMessageId) : "Not marked yet"}
                </p>
                <button type="button" className="ghost-btn" onClick={() => setTab("chat")}>
                  Go to Chat to mark
                </button>
              </div>
            )}

            {aiMode === "dates" && (
              <div className="date-row">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            )}

            <form onSubmit={handleAskAi}>
              <textarea
                placeholder="Example: Summarize decisions and who is doing what"
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                rows={3}
              />
              <button type="submit" disabled={aiLoading}>
                {aiLoading ? "Thinking..." : "Ask AI"}
              </button>
            </form>
          </section>

          {aiAnswer && (
            <section className="panel">
              <h2>Answer</h2>
              <p className="answer">{aiAnswer}</p>
            </section>
          )}
        </div>
      )}

      <ToastContainer />
    </Container>
  );
}

const Container = styled.div`
  height: 100vh;
  background:
    radial-gradient(800px 300px at 0% 0%, rgba(200, 255, 61, 0.07), transparent 50%),
    #070708;
  color: #f4f4f5;
  display: flex;
  flex-direction: column;
  animation: sf-fade-up 0.35s ease both;

  header {
    padding: 1rem 1.2rem;
    border-bottom: 1px solid #2a2a2e;
    background: rgba(18, 18, 20, 0.95);
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: flex-end;
    flex-wrap: wrap;

    h1 {
      margin: 0.4rem 0 0.35rem;
      color: #f4f4f5;
      font-family: var(--font-display);
      font-size: 1.35rem;
      letter-spacing: -0.02em;
    }

    p {
      margin: 0;
      color: #8b8b93;
      font-size: 0.85rem;
    }

    .code,
    .role {
      color: #c8ff3d;
      font-weight: 700;
    }
  }

  .back {
    background: transparent;
    border: 1px solid #2a2a2e;
    color: #f4f4f5;
    border-radius: 8px;
    padding: 0.35rem 0.7rem;
    cursor: pointer;
    transition: border-color 0.15s ease;

    &:hover {
      border-color: #c8ff3d;
    }
  }

  .tabs {
    display: flex;
    gap: 0.5rem;

    button {
      background: transparent;
      border: 1px solid #2a2a2e;
      color: #f4f4f5;
      border-radius: 999px;
      padding: 0.45rem 0.9rem;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .active {
      background: #c8ff3d;
      color: #0a0a0b;
      border-color: #c8ff3d;
      font-weight: 700;
    }
  }

  .chat {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }

  .range-bar {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
    padding: 0.7rem 1rem;
    border-bottom: 1px solid #2a2a2e;
    background: #151518;

    p {
      margin: 0.15rem 0;
      color: #c4c4cc;
      font-size: 0.85rem;
    }

    .muted {
      color: #8b8b93;
      font-size: 0.78rem;
    }

    .range-actions {
      display: flex;
      gap: 0.45rem;
    }

    button {
      background: #c8ff3d;
      color: #0a0a0b;
      border: none;
      border-radius: 8px;
      padding: 0.45rem 0.75rem;
      font-weight: 700;
      cursor: pointer;
    }

    .ghost {
      background: transparent;
      color: #c8ff3d;
      border: 1px solid #2a2a2e;
    }
  }

  .algo-bar {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 0.6rem;
    padding: 0.65rem 1rem;
    border-bottom: 1px solid #2a2a2e;
    background: linear-gradient(90deg, #12140a 0%, #151518 55%);

    .algo-left {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }

    select {
      background: #0a0a0b;
      border: 1px solid #2a2a2e;
      color: #f4f4f5;
      border-radius: 8px;
      padding: 0.4rem 0.55rem;
      outline: none;
    }

    button {
      background: #c8ff3d;
      color: #0a0a0b;
      border: none;
      border-radius: 8px;
      padding: 0.45rem 0.8rem;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.15s ease;

      &:hover {
        transform: translateY(-1px);
      }
    }
  }

  .busy-bar {
    background: rgba(200, 255, 61, 0.06);
    border-bottom-color: rgba(200, 255, 61, 0.25);
  }

  .msg-row.busy-hit {
    animation: sf-fade-up 0.35s ease both;
  }

  .bubble.busy-glow {
    box-shadow: 0 0 0 2px rgba(200, 255, 61, 0.55),
      0 0 18px rgba(200, 255, 61, 0.18);
    border-color: #c8ff3d;
  }

  .busy-tag {
    display: inline-block;
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: #0a0a0b;
    background: #c8ff3d;
    border-radius: 4px;
    padding: 0.12rem 0.35rem;
    margin-bottom: 0.25rem;
  }

  .msg-row {
    display: flex;
    align-items: flex-start;
    gap: 0.35rem;
    max-width: 85%;
  }

  .msg-row.left {
    align-self: flex-start;
  }

  .msg-row.right {
    align-self: flex-end;
    flex-direction: row-reverse;
  }

  .chat-avatar {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1px solid #2a2a2e;
    background: #0a0a0b;
    flex-shrink: 0;
    margin-top: 0.15rem;
  }

  .bubble {
    max-width: 100%;
    padding: 0.7rem 0.9rem;
    border-radius: 12px;

    p {
      margin: 0;
      word-break: break-word;
      white-space: pre-wrap;
    }

    .name {
      display: block;
      font-size: 0.75rem;
      color: #c8ff3d;
      margin-bottom: 0.25rem;
    }

    .mark-tag {
      display: inline-block;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      margin-bottom: 0.3rem;
      padding: 0.12rem 0.4rem;
      border-radius: 999px;
      background: #0a0a0b;
      color: #c8ff3d;
    }
  }

  .bubble.marked {
    outline: 1px solid #c8ff3d;
  }

  .mine {
    background: #c8ff3d;
    color: #0a0a0b;

    .mark-tag {
      background: #0a0a0b;
      color: #c8ff3d;
    }
  }

  .other {
    background: #1a1a1e;
    border: 1px solid #2a2a2e;
  }

  .msg-menu {
    position: relative;
    margin-top: 0.2rem;
  }

  .menu-btn {
    background: transparent;
    border: 1px solid #2a2a2e;
    color: #c4c4cc;
    border-radius: 6px;
    width: 28px;
    height: 28px;
    cursor: pointer;
  }

  .menu-dropdown {
    position: absolute;
    top: 32px;
    right: 0;
    z-index: 5;
    background: #121214;
    border: 1px solid #2a2a2e;
    border-radius: 10px;
    min-width: 140px;
    overflow: hidden;

    button {
      display: block;
      width: 100%;
      text-align: left;
      background: transparent;
      border: none;
      color: #f4f4f5;
      padding: 0.55rem 0.75rem;
      cursor: pointer;
    }

    button:hover {
      background: #1a1a1e;
      color: #c8ff3d;
    }
  }

  .composer {
    display: flex;
    gap: 0.6rem;
    padding: 0.8rem 1rem;
    border-top: 1px solid #2a2a2e;
    background: #121214;
    align-items: flex-end;
  }

  .composer textarea {
    flex: 1;
    min-height: 44px;
    max-height: 140px;
    overflow-y: auto;
    resize: none;
    line-height: 1.4;
  }

  .polls {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .panel {
    background: #121214;
    border: 1px solid #2a2a2e;
    border-radius: 14px;
    padding: 1rem;

    h2 {
      margin: 0 0 0.8rem;
      color: #c8ff3d;
      font-family: var(--font-display);
      font-size: 1rem;
      letter-spacing: 0.02em;
    }

    form {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }
  }

  input {
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

  button[type="submit"],
  .member-row button,
  .option-row button,
  .close-btn {
    background: #c8ff3d;
    color: #0a0a0b;
    border: none;
    border-radius: 10px;
    padding: 0.7rem 1rem;
    font-weight: 700;
    cursor: pointer;
  }

  .close-btn {
    margin-top: 0.8rem;
    background: transparent;
    color: #c8ff3d;
    border: 1px solid #c8ff3d;
  }

  .member-row,
  .option-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.8rem;
    margin-bottom: 0.55rem;
  }

  .hint {
    color: #8b8b93;
  }

  .poll-card {
    border: 1px solid #2a2a2e;
    border-radius: 12px;
    padding: 0.9rem;
    margin-bottom: 0.8rem;
  }

  .poll-top {
    display: flex;
    justify-content: space-between;
    gap: 0.8rem;

    h3 {
      margin: 0;
      font-size: 1rem;
    }

    span {
      color: #c8ff3d;
      font-size: 0.8rem;
    }
  }

  .by {
    color: #8b8b93;
    font-size: 0.8rem;
    margin: 0.35rem 0 0.7rem;
  }

  .option {
    margin-bottom: 0.55rem;
  }

  .bar {
    height: 6px;
    background: #2a2a2e;
    border-radius: 999px;
    overflow: hidden;

    div {
      height: 100%;
      background: #c8ff3d;
    }
  }

  .mode-row,
  .date-row {
    display: flex;
    gap: 0.6rem;
    margin-bottom: 0.8rem;
    flex-wrap: wrap;
  }

  .mode-row button {
    background: transparent;
    color: #c8ff3d;
    border: 1px solid #2a2a2e;
    border-radius: 999px;
    padding: 0.4rem 0.8rem;
    cursor: pointer;
  }

  .active-mode {
    background: #c8ff3d !important;
    color: #0a0a0b !important;
    border-color: #c8ff3d !important;
    font-weight: 700;
  }

  .selected-box {
    border: 1px solid #2a2a2e;
    border-radius: 10px;
    padding: 0.8rem;
    margin-bottom: 0.8rem;

    p {
      margin: 0.25rem 0;
      color: #c4c4cc;
      font-size: 0.9rem;
    }
  }

  .ghost-btn {
    margin-top: 0.55rem;
    background: transparent;
    color: #c8ff3d;
    border: 1px solid #2a2a2e;
    border-radius: 8px;
    padding: 0.4rem 0.7rem;
    cursor: pointer;
  }

  textarea {
    width: 100%;
    background: #0a0a0b;
    border: 1px solid #2a2a2e;
    border-radius: 10px;
    padding: 0.8rem;
    color: #f4f4f5;
    outline: none;
    resize: vertical;
    font-family: inherit;

    &:focus {
      border-color: #c8ff3d;
    }
  }

  .answer {
    white-space: pre-wrap;
    line-height: 1.5;
    color: #e8e8ec;
  }
`;

export default ProjectRoom;
