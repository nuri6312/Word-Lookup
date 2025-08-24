// app.js

// --- Core classes ---
class TrieNode {
  constructor() {
    this.children = new Map();
    this.isEndOfWord = false;
    this.definition = "";
  }
}

class WordDictionary {
  constructor() {
    this.root = new TrieNode();
    this.wordList = [];
    this.wordsSet = new Set(); // NEW: track uniques
  }

  insertWord(word, definition = "") {
    const lowerWord = word.toLowerCase();

    // If word already exists, optionally update definition and skip re-insert
    if (this.wordsSet.has(lowerWord)) {
      if (definition) {
        let cur = this.root;
        for (const ch of lowerWord) cur = cur.children.get(ch);
        if (cur) cur.definition = definition || cur.definition;
      }
      return;
    }

    // Normal insert
    let current = this.root;
    for (let char of lowerWord) {
      if (!current.children.has(char)) current.children.set(char, new TrieNode());
      current = current.children.get(char);
    }
    current.isEndOfWord = true;
    current.definition = definition;

    this.wordsSet.add(lowerWord);  // mark as seen
    this.wordList.push(lowerWord); // store once
  }

  searchWord(word) {
    let current = this.root;
    const lowerWord = word.toLowerCase();
    for (let char of lowerWord) {
      if (!current.children.has(char)) return { found: false, definition: "" };
      current = current.children.get(char);
    }
    return { found: current.isEndOfWord, definition: current.definition };
  }

  getAutoSuggestions(prefix, maxSuggestions = 10) {
    const suggestions = [];
    let current = this.root;
    const lowerPrefix = prefix.toLowerCase();
    for (let char of lowerPrefix) {
      if (!current.children.has(char)) return [];
      current = current.children.get(char);
    }
    // collect a little extra then dedupe & trim
    this.#dfs(current, lowerPrefix, suggestions, maxSuggestions * 3);
    const unique = Array.from(new Set(suggestions));
    return unique.slice(0, maxSuggestions);
  }

  #dfs(node, prefix, suggestions, maxSuggestions) {
    if (suggestions.length >= maxSuggestions) return;
    if (node.isEndOfWord) suggestions.push(prefix);
    for (let [char, childNode] of node.children) {
      this.#dfs(childNode, prefix + char, suggestions, maxSuggestions);
    }
  }

  editDistance(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  getSpellingCorrections(word, maxDistance = 2, maxSuggestions = 5) {
    const lowerWord = word.toLowerCase();
    const candidates = [];

    for (let dictWord of this.wordList) {
      const distance = this.editDistance(lowerWord, dictWord);
      if (distance > 0 && distance <= maxDistance) {
        candidates.push({ word: dictWord, distance });
      }
    }

    // Sort by distance then alphabetical; keep first occurrence of each word
    candidates.sort((a, b) => a.distance - b.distance || a.word.localeCompare(b.word));

    const seen = new Set();
    const unique = [];
    for (const c of candidates) {
      if (!seen.has(c.word)) {
        seen.add(c.word);
        unique.push(c);
        if (unique.length >= maxSuggestions) break;
      }
    }

    return unique.map(x => x.word);
  }

  // --- Data loading ---
  // If your Node.js backend returns JSON, call loadFromApi()
  // and remove PapaParse + this CSV method.
  async loadFromCsvFile(path = "dictionary.csv") {
    this.#showLoadingMessage(`Loading dictionary from ${path}...`);
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const csvText = await response.text();
      const parsed = Papa.parse(csvText, { header: false, skipEmptyLines: true });
      let total = 0;
      parsed.data.forEach(row => {
        const word = row[0]?.trim();
        const definition = row.slice(1).join(" ").trim();
        if (word) { this.insertWord(word, definition); total++; }
      });
      this.#showSuccessMessage(`✅ Dictionary loaded! ${total} words.`);
    } catch (err) {
      console.error("Error loading CSV:", err);
      this.#showErrorMessage("❌ Failed to load dictionary.");
    }
  }

  async loadFromApi(endpoint = "/api/dictionary") {
    // Example expected JSON: [{ word: "apple", definition: "..." }, ...]
    this.#showLoadingMessage("Loading dictionary from API...");
    try {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      let total = 0;
      for (const item of data) {
        const word = item.word?.trim();
        const definition = (item.definition || "").trim();
        if (word) { this.insertWord(word, definition); total++; }
      }
      this.#showSuccessMessage(`✅ Dictionary loaded! ${total} words.`);
    } catch (err) {
      console.error("Error loading API data:", err);
      this.#showErrorMessage("❌ Failed to load dictionary from API.");
    }
  }

  // Private UI helpers
  #showLoadingMessage(message) {
    const el = document.getElementById("resultsSection");
    if (!el) return;
    el.innerHTML = `
      <div class="loading">
        <div class="status-icon">📚</div>
        ${message}
      </div>`;
  }

  #showSuccessMessage(message) {
    const el = document.getElementById("resultsSection");
    if (!el) return;
    el.innerHTML = `
      <div class="results-title"><span class="status-icon success">✅</span>${message}</div>
      <div class="not-found">Ready to search! Try typing a word above. 🔍</div>`;
  }

  #showErrorMessage(message) {
    const el = document.getElementById("resultsSection");
    if (!el) return;
    el.innerHTML = `
      <div class="not-found">
        <span class="status-icon error">⚠️</span>
        ${message}
      </div>`;
  }
}

// --- App wiring ---
const dictionary = new WordDictionary();

document.addEventListener("DOMContentLoaded", async () => {
  // Use ONE of the following depending on your setup:

  // 1) If serving words from Node (recommended):
  // await dictionary.loadFromApi("/api/dictionary");

  // 2) If still loading a local CSV on the client:
  await dictionary.loadFromCsvFile("dictionary.csv");
});

// UI helpers
function showLoading() {
  document.getElementById("resultsSection").innerHTML = `
    <div class="loading">
      <div class="status-icon">⏳</div>
      Processing your request...
    </div>`;
}

function showError(message) {
  document.getElementById("resultsSection").innerHTML = `
    <div class="not-found">
      <span class="status-icon error">⚠️</span>
      ${message}
    </div>`;
}

// Actions (referenced by HTML onclick)
function searchWord() {
  const word = document.getElementById("searchInput").value.trim();
  if (!word) return showError("Please enter a word to search");
  showLoading();
  setTimeout(() => {
    const result = dictionary.searchWord(word);
    const el = document.getElementById("resultsSection");
    if (result.found) {
      el.innerHTML = `
        <div class="results-title"><span class="status-icon success">✅</span>Word Found!</div>
        <div class="word-result">
          <div class="word-title">${word.toLowerCase()}</div>
          <div class="word-definition">${result.definition}</div>
        </div>`;
    } else {
      const corrections = dictionary.getSpellingCorrections(word, 2, 3);
      const correctionHTML = corrections.length
        ? `<div style="margin-top:20px;"><strong>Did you mean:</strong><ul class="suggestions-list">${corrections
            .map(c => `<li onclick="searchSpecificWord('${c}')">${c}</li>`)
            .join("")}</ul></div>`
        : "";
      el.innerHTML = `
        <div class="results-title"><span class="status-icon error">❌</span>Word Not Found</div>
        <div class="not-found">The word "<strong>${word}</strong>" was not found in the dictionary.${correctionHTML}</div>`;
    }
  }, 200);
}

function getAutoSuggestions() {
  const prefix = document.getElementById("searchInput").value.trim();
  if (!prefix) return showError("Please enter a prefix for suggestions");
  showLoading();
  setTimeout(() => {
    const suggestions = dictionary.getAutoSuggestions(prefix, 15);
    const el = document.getElementById("resultsSection");
    if (suggestions.length) {
      el.innerHTML = `
        <div class="results-title"><span class="status-icon info">💡</span>Auto-suggestions for "${prefix}"</div>
        <ul class="suggestions-list">${suggestions
          .map(s => `<li onclick="searchSpecificWord('${s}')">${s}</li>`)
          .join("")}</ul>`;
    } else {
      el.innerHTML = `
        <div class="not-found"><span class="status-icon">🤷‍♂️</span>No suggestions found for "<strong>${prefix}</strong>"</div>`;
    }
  }, 150);
}

function getSpellingCorrections() {
  const word = document.getElementById("searchInput").value.trim();
  if (!word) return showError("Please enter a word for spell checking");
  showLoading();
  setTimeout(() => {
    const corrections = dictionary.getSpellingCorrections(word, 3, 10);
    const el = document.getElementById("resultsSection");
    if (corrections.length) {
      el.innerHTML = `
        <div class="results-title"><span class="status-icon info">✏️</span>Spelling corrections for "${word}"</div>
        <ul class="suggestions-list">${corrections
          .map(c => `<li onclick="searchSpecificWord('${c}')">${c}</li>`)
          .join("")}</ul>`;
    } else {
      el.innerHTML = `
        <div class="not-found"><span class="status-icon">✅</span>No spelling corrections needed for "<strong>${word}</strong>"</div>`;
    }
  }, 150);
}

function searchSpecificWord(word) {
  document.getElementById("searchInput").value = word;
  searchWord();
}

// Enter key + lightweight live suggestions hook
const inputEl = document.getElementById("searchInput");
inputEl.addEventListener("keypress", e => {
  if (e.key === "Enter") searchWord();
});

let debounceTimer;
inputEl.addEventListener("input", e => {
  clearTimeout(debounceTimer);
  const value = e.target.value.trim();
  if (value.length >= 2) {
    debounceTimer = setTimeout(() => {
      // could surface suggestions dropdown here if desired
      dictionary.getAutoSuggestions(value, 5);
    }, 250);
  }
});
