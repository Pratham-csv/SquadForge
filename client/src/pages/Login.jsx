import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from "axios";
import { loginRoute } from "../utils/APIRoutes";
import { saveSession } from "../utils/authStorage";

function Login() {
  const navigate = useNavigate();
  const [values, setValues] = useState({
    username: "",
    password: "",
  });

  const toastOptions = {
    position: "bottom-right",
    autoClose: 4000,
    theme: "dark",
  };

  function handleChange(event) {
    setValues({
      ...values,
      [event.target.name]: event.target.value,
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const { username, password } = values;

    if (username === "" || password === "") {
      toast.error("Username and password are required", toastOptions);
      return;
    }

    const { data } = await axios.post(loginRoute, {
      username,
      password,
    });

    if (data.status === false) {
      toast.error(data.msg, toastOptions);
      return;
    }

    if (data.status === true) {
      saveSession({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      if (!data.user.isAvatarImageSet) {
        navigate("/setAvatar");
      } else {
        navigate("/");
      }
    }
  }

  return (
    <>
      <Page>
        <div className="glow glow-a" />
        <div className="glow glow-b" />
        <div className="grid" />

        <div className="shell">
          <div className="brand-block">
            <p className="eyebrow">project chat for squads</p>
            <h1>SquadForge</h1>
            <p className="tagline">
              Ditch noisy WhatsApp groups. Align, decide, and ship together.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <h2>Welcome back</h2>
            <input
              type="text"
              placeholder="Username"
              name="username"
              onChange={handleChange}
            />
            <input
              type="password"
              placeholder="Password"
              name="password"
              onChange={handleChange}
            />
            <button type="submit">Log In</button>
            <span>
              New here? <Link to="/register">Create account</Link>
            </span>
          </form>
        </div>
      </Page>
      <ToastContainer />
    </>
  );
}

const Page = styled.div`
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  background: radial-gradient(1200px 600px at 10% -10%, #1a2208 0%, transparent 55%),
    radial-gradient(900px 500px at 100% 100%, #101820 0%, transparent 50%),
    #070708;

  .glow {
    position: absolute;
    border-radius: 50%;
    filter: blur(60px);
    pointer-events: none;
    animation: sf-pulse 6s ease-in-out infinite;
  }

  .glow-a {
    width: 280px;
    height: 280px;
    background: rgba(200, 255, 61, 0.16);
    top: 12%;
    left: 8%;
  }

  .glow-b {
    width: 220px;
    height: 220px;
    background: rgba(80, 140, 255, 0.12);
    bottom: 10%;
    right: 12%;
    animation-delay: 1.2s;
  }

  .grid {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    background-size: 48px 48px;
    mask-image: radial-gradient(circle at center, black 30%, transparent 75%);
    pointer-events: none;
  }

  .shell {
    width: min(980px, 100%);
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    gap: 2rem;
    align-items: center;
    position: relative;
    z-index: 1;
    animation: sf-fade-up 0.55s ease both;
  }

  .brand-block {
    padding: 0.5rem;

    .eyebrow {
      color: #c8ff3d;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      font-size: 0.75rem;
      font-weight: 700;
      margin-bottom: 0.8rem;
    }

    h1 {
      font-family: var(--font-display);
      font-size: clamp(2.8rem, 7vw, 4.6rem);
      line-height: 0.95;
      letter-spacing: -0.03em;
      color: #f4f4f5;
      margin: 0;
    }

    .tagline {
      margin-top: 1rem;
      max-width: 28rem;
      color: #9a9aa3;
      font-size: 1.05rem;
      line-height: 1.55;
    }
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 0.95rem;
    background: rgba(18, 18, 20, 0.88);
    border: 1px solid #2a2a2e;
    border-radius: 20px;
    padding: 1.8rem;
    backdrop-filter: blur(10px);

    h2 {
      font-family: var(--font-display);
      font-size: 1.35rem;
      margin: 0 0 0.2rem;
    }
  }

  input {
    background: #0a0a0b;
    border: 1px solid #2a2a2e;
    border-radius: 12px;
    padding: 0.95rem 1rem;
    color: #f4f4f5;
    font-size: 1rem;
    outline: none;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;

    &:focus {
      border-color: #c8ff3d;
      box-shadow: 0 0 0 3px rgba(200, 255, 61, 0.12);
    }
  }

  button {
    background: #c8ff3d;
    color: #0a0a0b;
    border: none;
    border-radius: 12px;
    padding: 0.95rem;
    font-weight: 700;
    font-size: 0.95rem;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    transition: transform 0.15s ease, filter 0.15s ease;

    &:hover {
      transform: translateY(-1px);
      filter: brightness(1.05);
    }
  }

  span {
    color: #a0a0a8;
    text-align: center;
    font-size: 0.92rem;

    a {
      color: #c8ff3d;
      font-weight: 700;
      text-decoration: none;
    }
  }

  @media (max-width: 800px) {
    .shell {
      grid-template-columns: 1fr;
      gap: 1.4rem;
    }

    .brand-block {
      text-align: center;

      .tagline {
        margin-left: auto;
        margin-right: auto;
      }
    }
  }
`;

export default Login;
