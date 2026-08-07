import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  createProjectRoute,
  myProjectsRoute,
  joinProjectRoute,
  projectRequestsRoute,
  handleRequestRoute,
} from "../utils/APIRoutes";

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
    const savedUser = localStorage.getItem(
      process.env.REACT_APP_LOCALHOST_KEY
    );

    if (!savedUser) {
      navigate("/login");
      return;
    }

    setUser(JSON.parse(savedUser));
  }, [navigate]);

  async function loadProjects(userId) {
    const { data } = await axios.get(`${myProjectsRoute}/${userId}`);
    if (data.status) {
      setProjects(data.projects);
    }
  }

  useEffect(() => {
    if (user) {
      loadProjects(user._id);
    }
  }, [user]);

  function handleLogout() {
    localStorage.removeItem(process.env.REACT_APP_LOCALHOST_KEY);
    navigate("/login");
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("Project name is required", toastOptions);
      return;
    }

    const { data } = await axios.post(createProjectRoute, {
      name,
      description,
      userId: user._id,
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

    const { data } = await axios.post(joinProjectRoute, {
      inviteCode: inviteCode.trim(),
      userId: user._id,
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
    const { data } = await axios.get(
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
    const { data } = await axios.post(handleRequestRoute, {
      projectId: selectedProject,
      requestId,
      userId: user._id,
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
      <header>
        <div>
          <h1>SquadForge</h1>
          <p>hey {user.username}</p>
        </div>
        <button className="logout" onClick={handleLogout}>
          Logout
        </button>
      </header>

      <div className="panels">
      <section>
          <h2>Create Project</h2>
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
        <h2>My Projects</h2>
        {projects.length === 0 && <p className="empty">No projects yet.</p>}
        {projects.map((project) => (
          <div className="card" key={project._id}>
            <div>
              <h3>{project.name}</h3>
              <p>{project.description || "No description"}</p>
              <p className="meta">
                Role: {getMyRole(project)} · Code: {project.inviteCode}
              </p>
            </div>
            {project.owner === user._id && (
              <button onClick={() => loadRequests(project._id)}>
                View Requests
              </button>
            )}
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
  background: #0a0a0b;
  color: #f4f4f5;
  padding: 2rem;

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;

    h1 {
      color: #c8ff3d;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    p {
      color: #8b8b93;
      margin: 0.3rem 0 0;
    }
  }

  grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  section {
    background: #121214;
    border: 1px solid #2a2a2e;
    border-radius: 14px;
    padding: 1.2rem;
  }

  h2 {
    margin: 0 0 1rem;
    font-size: 1rem;
    color: #c8ff3d;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
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

  button {
    background: #c8ff3d;
    color: #0a0a0b;
    border: none;
    border-radius: 10px;
    padding: 0.75rem 1rem;
    font-weight: 700;
    cursor: pointer;
  }

  .logout,
  .reject {
    background: transparent;
    color: #c8ff3d;
    border: 1px solid #c8ff3d;
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
    border-radius: 12px;
    padding: 1rem;
    margin-bottom: 0.8rem;

    h3 {
      margin: 0 0 0.3rem;
    }

    p {
      margin: 0;
      color: #b0b0b8;
      font-size: 0.9rem;
    }

    .meta {
      margin-top: 0.4rem;
      color: #c8ff3d;
      font-size: 0.85rem;
    }
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }

  .empty {
    color: #8b8b93;
  }
`;

export default Home;