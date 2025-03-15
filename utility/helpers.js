import natural from "natural";
import fs from "fs/promises";

export const stopWords = natural.stopwords;
export const preProcessText = (textArray) => {
  return textArray.map((text) =>
    text
      .replace(/[!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]/g, "")
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word && !stopWords.includes(word))
      .map((word) => natural.PorterStemmer.stem(word))
      .join(" "),
  );
};

export async function getDocumentLength(documentId, sqlOperation) {
  const doc = await sqlOperation(documentId);
  return JSON.parse(doc.dataValues.paragraphs).join(" ").split(" ").length;
}

export function removePunctuation(p) {
  return p.replace(/[^\w\s]/g, "");
}

export const getDomain = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
};

export const shouldSkipLink = (url) => {
  if (
    url.includes("oldid=") ||
    url.includes("/wiki/Talk:") ||
    url.includes("/wiki/User:") ||
    url.includes("/wiki/File:") ||
    url.includes("#") ||
    url.includes("tinyzone.org/country/") ||
    url.includes("Special:") ||
    url.includes("Portal:") ||
    url.includes("www.geeksforgeeks.org/quizzes") ||
    url.includes("www.geeksforgeeks.org/puzzles") ||
    url.includes("Wikipedia:") ||
    url.includes("community") ||
    url.includes("user") ||
    url.includes("post") ||
    url.includes("users") ||
    url.includes("Help:") ||
    url.includes("Template:") ||
    url.includes("User_talk:") ||
    url.includes("/election/")
  ) {
    return true;
  }
};

export async function crawlWithDelay(url, crawl, depth) {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await crawl(url, depth);
}

export async function saveState(path, state, tf_idf) {
  try {
    if (!tf_idf) {
      await fs.writeFile(
        path,
        JSON.stringify({
          corpus: state.corpus,
          processedTerms: Array.from(state.processedTerms),
        }),
      );
    } else {
      await fs.writeFile(
        path,
        JSON.stringify({
          terms: state.terms,
        }),
      );
    }
    console.log("State saved successfully.");
  } catch (error) {
    console.error("Error saving state:", error);
  }
}

export async function loadState(path, tf_idf) {
  try {
    if (!tf_idf) {
      const data = await fs.readFile(path, "utf-8");

      if (!data.trim()) {
        console.warn("State file is empty. Returning fresh state.");
        return {
          corpus: [],
          processedTerms: new Set(),
        };
      }

      const parsedData = JSON.parse(data);
      return {
        corpus: parsedData.corpus || [],
        processedTerms: new Set(parsedData.processedTerms || []),
      };
    } else {
      const data = await fs.readFile(path, "utf-8");
      if (!data.trim()) {
        console.warn("State file is empty. Returning fresh state.");
        return {
          terms: [],
        };
      }
      const parsedData = JSON.parse(data);
      return {
        terms: parsedData.terms || [],
      };
    }
  } catch (error) {
    console.error("Error loading state:", error);
    throw error;
  }
}
