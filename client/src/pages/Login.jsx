import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from "axios";
import { loginRoute } from "../utils/APIRoutes";

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
      localStorage.setItem(
        process.env.REACT_APP_LOCALHOST_KEY,
        JSON.stringify(data.user)
      );
      navigate("/");
    }
  }

  return (
    <>
      <FormContainer>
        <form onSubmit={handleSubmit}>
          <div className="brand">
            <h1>SquadForge</h1>
            <p>welcome back</p>
          </div>

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
      </FormContainer>
      <ToastContainer />
    </>
  );
}

const FormContainer = styled.div`
  height: 100vh;
  width: 100vw;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #0a0a0b;

  form {
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
    background: #121214;
    border: 1px solid #2a2a2e;
    border-radius: 16px;
    padding: 2.5rem 3rem;
    width: min(420px, 92vw);
  }

  .brand {
    text-align: center;
    margin-bottom: 0.5rem;

    h1 {
      color: #c8ff3d;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin: 0;
      font-size: 1.8rem;
    }

    p {
      color: #8b8b93;
      margin: 0.4rem 0 0;
      font-size: 0.9rem;
    }
  }

  input {
    background: #0a0a0b;
    border: 1px solid #2a2a2e;
    border-radius: 10px;
    padding: 0.9rem;
    color: #f4f4f5;
    font-size: 1rem;
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
    padding: 0.9rem;
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  span {
    color: #c4c4cc;
    text-align: center;
    font-size: 0.9rem;

    a {
      color: #c8ff3d;
      font-weight: 700;
      text-decoration: none;
    }
  }
`;

export default Login;