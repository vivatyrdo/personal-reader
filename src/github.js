import { Octokit } from "@octokit/rest";
import ePub from "epubjs";

const octokit = new Octokit(); // без токена

const owner = "vivatyrdo";
const repo = "my-books-data";

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
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Ошибка скачивания');
  return await response.arrayBuffer();
};

export const getBookCover = async (path) => {
  const data = await getBookFile(path);
  const book = ePub(data);
  await book.ready;
  const cover = await book.coverUrl();
  book.destroy();
  return cover;
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
  const token = import.meta.env.VITE_GITHUB_TOKEN;
  const authedOctokit = new Octokit({ auth: token });
  const path = 'progress.json';
  let sha;
  let currentContent = {};

  try {
    const res = await authedOctokit.rest.repos.getContent({ owner, repo, path });
    sha = res.data.sha;
    const content = Uint8Array.from(atob(res.data.content), c => c.charCodeAt(0));
    currentContent = JSON.parse(new TextDecoder().decode(content));
  } catch (e) {}

  currentContent[bookPath] = { cfi, updatedAt: new Date().toISOString() };
  const finalJson = JSON.stringify(currentContent);
  const encodedContent = btoa(unescape(encodeURIComponent(finalJson)));

  await authedOctokit.rest.repos.createOrUpdateFileContents({
    owner, repo, path,
    message: `Save progress: ${bookPath}`,
    content: encodedContent,
    sha
  });
};