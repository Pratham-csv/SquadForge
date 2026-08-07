import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";

function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(undefined);

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

  function handleLogout() {
    localStorage.removeItem(process.env.REACT_APP_LOCALHOST_KEY);
    navigate("/login");
  }

  if (!user) {
    return null;
  }

  return (
    <Container>
      <h1>SquadForge</h1>
      <p>Hey {user.username}, you are logged in.</p>
      <p className="note">Projects page will come next.</p>
      <button onClick={handleLogout}>Logout</button>
    </Container>
  );
}

const Container = styled.div`
  min-height: 100vh;
  background: #0a0a0b;
  color: #f4f4f5;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 0.8rem;

  h1 {
    color: #c8ff3d;
    margin: 0;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .note {
    color: #8b8b93;
  }

  button {
    margin-top: 1rem;
    background: transparent;
    color: #c8ff3d;
    border: 1px solid #c8ff3d;
    border-radius: 10px;
    padding: 0.7rem 1.2rem;
    cursor: pointer;
    font-weight: 700;
  }
`;

export default Home;