import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  createProjectRoute,
  myProjectsRoute,
  joinProjectRoute,
  projectRequestsRoute,
  handleRequestRoute,
  logoutRoute,
} from "../utils/APIRoutes";
import api from "../utils/api";
import { getUser, getRefreshToken, clearSession } from "../utils/authStorage";

function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(undefined);
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [requests, setRequests] = useState([]);

  const toastOptions = {
    position: "bottom-right",
    autoClose: 3000,
    theme: "dark",
  };

  useEffect(() => {
    const savedUser = getUser();

    if (!savedUser) {
      navigate("/login");
      return;
    }

    setUser(savedUser);
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    if (!user.isAvatarImageSet) {
      navigate("/setAvatar");
    }
  }, [user, navigate]);

  async function loadProjects(userId) {
    const { data } = await api.get(`${myProjectsRoute}/${userId}`);
    if (data.status) {
      setProjects(data.projects);
    }
  }

  useEffect(() => {
    if (user) {
      loadProjects(user._id);
    }
  }, [user]);

  async function handleLogout() {
    try {
      await api.post(logoutRoute, { refreshToken: getRefreshToken() });
    } catch {
      // still clear local session
    }
    clearSession();
    navigate("/login");
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("Project name is required", toastOptions);
      return;
    }

    const { data } = await api.post(createProjectRoute, {
      name,
      description,
    });

    if (!data.status) {
      toast.error(data.msg || "Could not create project", toastOptions);
      return;
    }

    toast.success(`Created! Code: ${data.project.inviteCode}`, toastOptions);
    setName("");
    setDescription("");
    loadProjects(user._id);
  }

  async function handleJoin(event) {
    event.preventDefault();
    if (!inviteCode.trim()) {
      toast.error("Invite code is required", toastOptions);
      return;
    }

    const { data } = await api.post(joinProjectRoute, {
      inviteCode: inviteCode.trim(),
    });

    if (!data.status) {
      toast.error(data.msg, toastOptions);
      return;
    }

    toast.success(data.msg, toastOptions);
    setInviteCode("");
  }

  async function loadRequests(projectId) {
    setSelectedProject(projectId);
    const { data } = await api.get(
      `${projectRequestsRoute}/${projectId}/${user._id}`
    );

    if (!data.status) {
      toast.error(data.msg, toastOptions);
      setRequests([]);
      return;
    }

    setRequests(data.requests);
  }

  async function handleRequest(requestId, action) {
    const { data } = await api.post(handleRequestRoute, {
      projectId: selectedProject,
      requestId,
      action,
    });

    if (!data.status) {
      toast.error(data.msg, toastOptions);
      return;
    }

    toast.success(data.msg, toastOptions);
    loadRequests(selectedProject);
    loadProjects(user._id);
  }

  function getMyRole(project) {
    const member = project.members.find(
      (m) => m.user === user._id || m.user?._id === user._id
    );
    return member ? member.role : "member";
  }

  if (!user) {
    return null;
  }

  return (
    <Container>
      <div className="bg" />
      <header>
        <div className="user-block">
          {user.avatarImage && (
            <img
              className="avatar"
              src={`data:image/svg+xml;base64,${user.avatarImage}`}
              alt={user.username}
            />
          )}
          <div>
            <p className="eyebrow">your workspace</p>
            <h1>SquadForge</h1>
            <p className="hello">Hey {user.username} — ready to build?</p>
          </div>
        </div>
        <button className="logout" onClick={handleLogout}>
          Logout
        </button>
      </header>

      <div className="panels">
        <section>
          <h2>Create Project</h2>
          <p className="section-copy">Spin up a room and share the invite code.</p>
          <form onSubmit={handleCreate}>
            <input
              placeholder="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              placeholder="Short description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button type="submit">Create</button>
          </form>
        </section>

        <section>
          <h2>Join with Code</h2>
          <p className="section-copy">Request access. Owner accepts you in.</p>
          <form onSubmit={handleJoin}>
            <input
              placeholder="SF-XXXXXX"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            />
            <button type="submit">Request Join</button>
          </form>
        </section>
      </div>

      <section className="list">
        <div className="list-head">
          <h2>My Projects</h2>
          <span>{projects.length} active</span>
        </div>
        {projects.length === 0 && (
          <p className="empty">No projects yet. Create one or join with a code.</p>
        )}
        {projects.map((project) => (
          <div className="card" key={project._id}>
            <div>
              <h3>{project.name}</h3>
              <p>{project.description || "No description"}</p>
              <p className="meta">
                <span className="pill">{getMyRole(project)}</span>
                <span className="code">{project.inviteCode}</span>
              </p>
            </div>
            <div className="actions">
              <button onClick={() => navigate(`/project/${project._id}`)}>
                Open
              </button>
              {project.owner === user._id && (
                <button className="ghost" onClick={() => loadRequests(project._id)}>
                  Requests
                </button>
              )}
            </div>
          </div>
        ))}
      </section>

      {selectedProject && (
        <section className="list">
          <h2>Pending Requests</h2>
          {requests.length === 0 && <p className="empty">No pending requests.</p>}
          {requests.map((req) => (
            <div className="card" key={req._id}>
              <div>
                <h3>{req.user.username}</h3>
                <p>{req.user.email}</p>
              </div>
              <div className="actions">
                <button onClick={() => handleRequest(req._id, "accept")}>
                  Accept
                </button>
                <button
                  className="reject"
                  onClick={() => handleRequest(req._id, "reject")}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <ToastContainer />
    </Container>
  );
}

const Container = styled.div`
  min-height: 100vh;
  color: #f4f4f5;
  padding: 2rem clamp(1rem, 4vw, 2.5rem) 3rem;
  position: relative;
  overflow: hidden;
  animation: sf-fade-up 0.45s ease both;

  .bg {
    position: absolute;
    inset: 0;
    background: radial-gradient(900px 420px at 0% 0%, rgba(200, 255, 61, 0.08), transparent 55%),
      radial-gradient(700px 400px at 100% 20%, rgba(70, 110, 255, 0.08), transparent 50%),
      #070708;
    z-index: 0;
  }

  > *:not(.bg) {
    position: relative;
    z-index: 1;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
    gap: 1rem;

    .user-block {
      display: flex;
      gap: 0.9rem;
      align-items: center;
    }

    .avatar {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: 2px solid #c8ff3d;
      background: #0a0a0b;
    }

    .eyebrow {
      color: #c8ff3d;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 0.72rem;
      font-weight: 700;
      margin: 0 0 0.45rem;
    }

    h1 {
      font-family: var(--font-display);
      color: #f4f4f5;
      margin: 0;
      font-size: clamp(2rem, 5vw, 2.8rem);
      letter-spacing: -0.03em;
    }

    .hello {
      color: #8b8b93;
      margin: 0.45rem 0 0;
    }
  }

  .panels {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1rem;
    margin-bottom: 1.2rem;
  }

  section {
    background: rgba(18, 18, 20, 0.9);
    border: 1px solid #2a2a2e;
    border-radius: 18px;
    padding: 1.25rem;
  }

  h2 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.05rem;
    color: #c8ff3d;
    letter-spacing: 0.02em;
  }

  .section-copy {
    color: #8b8b93;
    font-size: 0.9rem;
    margin: 0.4rem 0 1rem;
  }

  .list-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;

    span {
      color: #8b8b93;
      font-size: 0.85rem;
    }

    h2 {
      margin: 0;
    }
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  input {
    background: #0a0a0b;
    border: 1px solid #2a2a2e;
    border-radius: 12px;
    padding: 0.85rem 0.95rem;
    color: #f4f4f5;
    outline: none;
    transition: border-color 0.2s ease;

    &:focus {
      border-color: #c8ff3d;
    }
  }

  button {
    background: #c8ff3d;
    color: #0a0a0b;
    border: none;
    border-radius: 12px;
    padding: 0.75rem 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.15s ease, filter 0.15s ease;

    &:hover {
      transform: translateY(-1px);
      filter: brightness(1.05);
    }
  }

  .logout,
  .reject,
  .ghost {
    background: transparent;
    color: #c8ff3d;
    border: 1px solid #2a2a2e;
  }

  .list {
    margin-top: 1rem;
  }

  .card {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
    border: 1px solid #2a2a2e;
    border-radius: 14px;
    padding: 1rem 1.1rem;
    margin-bottom: 0.75rem;
    background: #0c0c0e;
    transition: border-color 0.2s ease, transform 0.15s ease;

    &:hover {
      border-color: rgba(200, 255, 61, 0.35);
      transform: translateY(-1px);
    }

    h3 {
      margin: 0 0 0.3rem;
      font-family: var(--font-display);
      font-size: 1.1rem;
    }

    p {
      margin: 0;
      color: #b0b0b8;
      font-size: 0.9rem;
    }

    .meta {
      margin-top: 0.55rem;
      display: flex;
      gap: 0.45rem;
      flex-wrap: wrap;
    }

    .pill,
    .code {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 0.2rem 0.55rem;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .pill {
      background: rgba(200, 255, 61, 0.12);
      color: #c8ff3d;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .code {
      background: #151518;
      color: #d7d7de;
      border: 1px solid #2a2a2e;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .empty {
    color: #8b8b93;
  }

  @media (max-width: 640px) {
    .card {
      flex-direction: column;
      align-items: flex-start;
    }

    .actions {
      width: 100%;

      button {
        flex: 1;
      }
    }
  }
`;

export default Home;
