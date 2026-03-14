import { Octokit } from "@octokit/rest";
import ePub from "epubjs";

const octokit = new Octokit({
  auth: import.meta.env.VITE_GITHUB_TOKEN,
});

const owner = import.meta.env.VITE_GITHUB_USERNAME;
const repo = import.meta.env.VITE_GITHUB_REPO;

export const getBooksList = async () => {
  try {
    const response = await octokit.rest.repos.getContent({ owner, repo, path: '' });
    return response.data.filter(file => file.name.toLowerCase().endsWith('.epub'));
  } catch (error) {
    console.error("Ошибка списка книг:", error);
    return [];
  }
};

export const getBookFile = async (path) => {
  const token = import.meta.env.VITE_GITHUB_TOKEN;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const response = await fetch(url, {
    headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3.raw' }
  });
  if (!response.ok) throw new Error('Ошибка скачивания');
  return await response.arrayBuffer();
};

export const getBookCover = async (path) => {
  const data = await getBookFile(path);
  const book = ePub(data);
  await book.ready;
  const cover = await book.coverUrl();
  book.destroy();
  return cover; // blob URL или null
};

export const getAllProgress = async () => {
  try {
    const res = await octokit.rest.repos.getContent({ owner, repo, path: 'progress.json' });
    const content = Uint8Array.from(atob(res.data.content), c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(content));
  } catch (e) {
    return {};
  }
};

export const saveProgress = async (bookPath, cfi) => {
  const path = 'progress.json';
  let sha;
  let currentContent = {};

  try {
    const res = await octokit.rest.repos.getContent({ owner, repo, path });
    sha = res.data.sha;
    const content = Uint8Array.from(atob(res.data.content), c => c.charCodeAt(0));
    currentContent = JSON.parse(new TextDecoder().decode(content));
  } catch (e) {}

  currentContent[bookPath] = { cfi, updatedAt: new Date().toISOString() };
  const finalJson = JSON.stringify(currentContent);
  const encodedContent = btoa(unescape(encodeURIComponent(finalJson)));

  await octokit.rest.repos.createOrUpdateFileContents({
    owner, repo, path,
    message: `Save progress: ${bookPath}`,
    content: encodedContent,
    sha
  });
};