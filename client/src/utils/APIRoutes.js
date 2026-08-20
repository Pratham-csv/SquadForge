// Browser talks to the API on the host. Override at build time for Docker/prod.
export const host = process.env.REACT_APP_API_URL || "http://localhost:5001";

export const registerRoute = `${host}/api/auth/register`;
export const loginRoute = `${host}/api/auth/login`;
export const refreshRoute = `${host}/api/auth/refresh`;
export const logoutRoute = `${host}/api/auth/logout`;
export const setAvatarRoute = `${host}/api/auth/setavatar`;

export const createProjectRoute = `${host}/api/projects/create`;
export const myProjectsRoute = `${host}/api/projects/my`;
export const joinProjectRoute = `${host}/api/projects/join`;
export const projectRequestsRoute = `${host}/api/projects/requests`;
export const handleRequestRoute = `${host}/api/projects/handle-request`;
export const getProjectRoute = `${host}/api/projects`;
export const promoteMemberRoute = `${host}/api/projects/promote`;

export const getMessagesRoute = `${host}/api/messages`;
export const addMessageRoute = `${host}/api/messages/add`;
export const busiestWindowRoute = `${host}/api/messages/busiest`;

export const createPollRoute = `${host}/api/polls/create`;
export const getPollsRoute = `${host}/api/polls`;
export const votePollRoute = `${host}/api/polls/vote`;
export const closePollRoute = `${host}/api/polls/close`;

export const askAiRoute = `${host}/api/ai/ask`;
