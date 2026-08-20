import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { setAvatarRoute } from "../utils/APIRoutes";
import api from "../utils/api";
import { getUser, updateStoredUser } from "../utils/authStorage";

function SetAvatar() {
  const navigate = useNavigate();
  const [avatars, setAvatars] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAvatar, setSelectedAvatar] = useState(undefined);
  const [user, setUser] = useState(undefined);

  const toastOptions = {
    position: "bottom-right",
    autoClose: 4000,
    theme: "dark",
  };

  useEffect(() => {
    const parsed = getUser();
    if (!parsed) {
      navigate("/login");
      return;
    }
    if (parsed.isAvatarImageSet) {
      navigate("/");
      return;
    }
    setUser(parsed);
  }, [navigate]);

  useEffect(() => {
    async function loadAvatars() {
      try {
        const data = [];
        for (let i = 0; i < 4; i++) {
          const seed = Math.random().toString(36).substring(2, 10);
          // Dicebear is free/reliable (same pick-avatar UX as Quirk's Multiavatar flow)
          const url = `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}`;
          const response = await axios.get(url);
          const base64 = window.btoa(unescape(encodeURIComponent(response.data)));
          data.push(base64);
        }
        setAvatars(data);
      } catch (err) {
        toast.error("Could not load avatars. Try refresh.", toastOptions);
      } finally {
        setIsLoading(false);
      }
    }

    loadAvatars();
  }, []);

  async function setProfilePicture() {
    if (selectedAvatar === undefined) {
      toast.error("Please select an avatar", toastOptions);
      return;
    }

    const { data } = await api.post(`${setAvatarRoute}/${user._id}`, {
      image: avatars[selectedAvatar],
    });

    if (data.isSet) {
      const updatedUser = {
        ...user,
        isAvatarImageSet: true,
        avatarImage: data.image,
      };
      updateStoredUser(updatedUser);
      navigate("/");
    } else {
      toast.error("Error setting avatar. Please try again.", toastOptions);
    }
  }

  async function reloadAvatars() {
    setIsLoading(true);
    setSelectedAvatar(undefined);
    const data = [];
    try {
      for (let i = 0; i < 4; i++) {
        const seed = Math.random().toString(36).substring(2, 10);
        const url = `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}`;
        const response = await axios.get(url);
        const base64 = window.btoa(unescape(encodeURIComponent(response.data)));
        data.push(base64);
      }
      setAvatars(data);
    } catch (err) {
      toast.error("Could not reload avatars", toastOptions);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Page>
      <div className="glow" />
      <div className="panel">
        <p className="eyebrow">profile setup</p>
        <h1>Pick your avatar</h1>
        <p className="sub">This shows up in chat and your squad rooms.</p>

        {isLoading ? (
          <div className="loading">Loading avatars...</div>
        ) : (
          <div className="avatars">
            {avatars.map((avatar, index) => (
              <button
                type="button"
                key={index}
                className={`avatar ${selectedAvatar === index ? "selected" : ""}`}
                onClick={() => setSelectedAvatar(index)}
              >
                <img
                  src={`data:image/svg+xml;base64,${avatar}`}
                  alt={`avatar ${index + 1}`}
                />
              </button>
            ))}
          </div>
        )}

        <div className="actions">
          <button type="button" className="ghost" onClick={reloadAvatars}>
            Shuffle
          </button>
          <button type="button" className="primary" onClick={setProfilePicture}>
            Set as Profile Picture
          </button>
        </div>
      </div>
      <ToastContainer />
    </Page>
  );
}

const Page = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  position: relative;
  overflow: hidden;
  background: radial-gradient(900px 500px at 50% -10%, rgba(200, 255, 61, 0.12), transparent 55%),
    #070708;
  animation: sf-fade-up 0.45s ease both;

  .glow {
    position: absolute;
    width: 240px;
    height: 240px;
    border-radius: 50%;
    background: rgba(200, 255, 61, 0.12);
    filter: blur(50px);
    top: 20%;
    right: 15%;
    pointer-events: none;
  }

  .panel {
    width: min(640px, 100%);
    background: rgba(18, 18, 20, 0.92);
    border: 1px solid #2a2a2e;
    border-radius: 22px;
    padding: 2rem 1.5rem;
    text-align: center;
    position: relative;
    z-index: 1;
  }

  .eyebrow {
    color: #c8ff3d;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-size: 0.72rem;
    font-weight: 700;
    margin-bottom: 0.6rem;
  }

  h1 {
    font-family: var(--font-display);
    font-size: clamp(1.8rem, 4vw, 2.4rem);
    margin: 0;
    letter-spacing: -0.03em;
  }

  .sub {
    color: #8b8b93;
    margin: 0.55rem 0 1.5rem;
  }

  .loading {
    color: #8b8b93;
    padding: 2rem 0;
  }

  .avatars {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .avatar {
    border: 3px solid transparent;
    background: #0a0a0b;
    border-radius: 50%;
    padding: 0.35rem;
    cursor: pointer;
    transition: border-color 0.2s ease, transform 0.15s ease;

    img {
      width: 88px;
      height: 88px;
      border-radius: 50%;
      display: block;
    }

    &:hover {
      transform: translateY(-2px);
      border-color: #3a3a40;
    }
  }

  .selected {
    border-color: #c8ff3d !important;
  }

  .actions {
    display: flex;
    gap: 0.7rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .primary,
  .ghost {
    border-radius: 12px;
    padding: 0.85rem 1.2rem;
    font-weight: 700;
    cursor: pointer;
  }

  .primary {
    background: #c8ff3d;
    color: #0a0a0b;
    border: none;
  }

  .ghost {
    background: transparent;
    color: #c8ff3d;
    border: 1px solid #2a2a2e;
  }
`;

export default SetAvatar;
