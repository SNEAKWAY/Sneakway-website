import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = Number(process.env.PORT) || 5020;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "xypht-admin";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";
const GITHUB_IMAGES_PATH =
  process.env.GITHUB_IMAGES_PATH || "frontend/public/uploads";
const GITHUB_PRODUCTS_PATH =
  process.env.GITHUB_PRODUCTS_PATH || "backend/products.json";
const GITHUB_SALE_PATH = process.env.GITHUB_SALE_PATH || "backend/sale.json";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.join(__dirname, "products.json");
const salePath = path.join(__dirname, "sale.json");

app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

const getGithubConfig = () => {
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    return null;
  }

  return {
    token: GITHUB_TOKEN,
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    branch: GITHUB_BRANCH,
    basePath: GITHUB_IMAGES_PATH,
  };
};

const parseImageDataUrl = (dataUrl) => {
  if (!dataUrl) {
    throw new Error("Missing image data.");
  }

  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid image data URL.");
  }

  const mimeType = match[1];
  const base64 = match[2];
  const extension = mimeType.split("/")[1]?.toLowerCase() || "png";

  return { base64, extension, mimeType };
};

const sanitizeFilename = (filename) =>
  filename
    ?.toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .replace(/^[-_]+/, "")
    .replace(/[-_]+$/, "");

const buildImagePath = (basePath, filename, extension) => {
  const safeName = sanitizeFilename(filename) || `image-${Date.now()}`;
  const hasExtension = safeName.includes(".");
  const finalName = hasExtension ? safeName : `${safeName}.${extension}`;
  const trimmedBase = basePath.replace(/\/+$/, "");

  return `${trimmedBase}/${Date.now()}-${finalName}`;
};

const buildRawUrl = ({ owner, repo, branch }, filePath) => {
  const encodedPath = filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodedPath}`;
};

const safeJsonParse = (raw, fallback, context) => {
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Failed to parse ${context}.`, error);
    return fallback;
  }
};

const requireAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");

  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ message: "Unauthorized." });
  }

  next();
};

const readProductsFromGithub = async (config) => {
  const apiUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${GITHUB_PRODUCTS_PATH}?ref=${config.branch}`;
  const response = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "xypht-backend",
    },
  });

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody?.message || "Failed to read products from GitHub."
    );
  }

  const payload = await response.json();
  const content = Buffer.from(payload.content || "", "base64").toString("utf-8");
  return safeJsonParse(content || "[]", [], "products.json from GitHub");
};

const readSaleFromGithub = async (config) => {
  const apiUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${GITHUB_SALE_PATH}?ref=${config.branch}`;
  const response = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "xypht-backend",
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody?.message || "Failed to read sale config from GitHub."
    );
  }

  const payload = await response.json();
  const content = Buffer.from(payload.content || "", "base64").toString("utf-8");
  return safeJsonParse(content || "null", null, "sale.json from GitHub");
};

const writeProductsToGithub = async (config, products) => {
  const apiUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${GITHUB_PRODUCTS_PATH}`;
  const existingResponse = await fetch(`${apiUrl}?ref=${config.branch}`, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "xypht-backend",
    },
  });

  let sha;
  if (existingResponse.ok) {
    const existingPayload = await existingResponse.json();
    sha = existingPayload?.sha;
  }

  const response = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "xypht-backend",
    },
    body: JSON.stringify({
      message: "Update products.json",
      content: Buffer.from(JSON.stringify(products, null, 2)).toString(
        "base64"
      ),
      branch: config.branch,
      sha,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody?.message || "Failed to write products to GitHub."
    );
  }
};

const writeSaleToGithub = async (config, sale) => {
  const apiUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${GITHUB_SALE_PATH}`;
  const existingResponse = await fetch(`${apiUrl}?ref=${config.branch}`, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "xypht-backend",
    },
  });

  let sha;
  if (existingResponse.ok) {
    const existingPayload = await existingResponse.json();
    sha = existingPayload?.sha;
  }

  const response = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "xypht-backend",
    },
    body: JSON.stringify({
      message: "Update sale.json",
      content: Buffer.from(JSON.stringify(sale, null, 2)).toString("base64"),
      branch: config.branch,
      sha,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody?.message || "Failed to write sale config to GitHub."
    );
  }
};

const readProducts = async () => {
  const githubConfig = getGithubConfig();
  if (githubConfig && GITHUB_PRODUCTS_PATH) {
    try {
      return await readProductsFromGithub(githubConfig);
    } catch (error) {
      console.error("Failed to read products from GitHub. Falling back.", error);
    }
  }

  try {
    const raw = await fs.readFile(dataPath, "utf-8");
    return safeJsonParse(raw, [], "products.json from disk");
  } catch (error) {
    console.error("Failed to read products from disk.", error);
    return [];
  }
};

const normalizeSaleConfig = (sale) => {
  if (!sale) {
    return { current: null, history: [] };
  }
  if (sale.current || Array.isArray(sale.history)) {
    return {
      current: sale.current || null,
      history: Array.isArray(sale.history) ? sale.history : [],
    };
  }
  return {
    current: sale,
    history: [],
  };
};

const readSale = async () => {
  const githubConfig = getGithubConfig();
  if (githubConfig && GITHUB_SALE_PATH) {
    try {
      const sale = await readSaleFromGithub(githubConfig);
      return normalizeSaleConfig(sale);
    } catch (error) {
      console.error("Failed to read sale from GitHub. Falling back.", error);
    }
  }

  try {
    const raw = await fs.readFile(salePath, "utf-8");
    return normalizeSaleConfig(
      safeJsonParse(raw, null, "sale.json from disk")
    );
  } catch (error) {
    if (error.code === "ENOENT") {
      return normalizeSaleConfig(null);
    }
    console.error("Failed to read sale from disk.", error);
    return normalizeSaleConfig(null);
  }
};

const writeProducts = async (products) => {
  const githubConfig = getGithubConfig();
  if (githubConfig && GITHUB_PRODUCTS_PATH) {
    await writeProductsToGithub(githubConfig, products);
    return;
  }

  await fs.writeFile(dataPath, JSON.stringify(products, null, 2));
};

const writeSale = async (sale) => {
  const githubConfig = getGithubConfig();
  if (githubConfig && GITHUB_SALE_PATH) {
    await writeSaleToGithub(githubConfig, sale);
    return;
  }

  await fs.writeFile(salePath, JSON.stringify(sale, null, 2));
};

app.get("/products", async (_req, res) => {
  try {
    const products = await readProducts();
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Failed to read products." });
  }
});

app.get("/products/:id", async (req, res) => {
  try {
    const products = await readProducts();
    const product = products.find((item) => item.id === req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: "Failed to read product." });
  }
});

app.get("/sale", async (_req, res) => {
  try {
    const sale = await readSale();
    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: "Failed to read sale config." });
  }
});

app.put("/sale", requireAdmin, async (req, res) => {
  try {
    const payload = req.body || {};
    const existing = await readSale();
    const nextCurrent = payload.current || null;
    const history = Array.isArray(existing.history) ? existing.history : [];

    if (nextCurrent?.enabled && nextCurrent?.name) {
      const alreadyTracked = history.some(
        (entry) =>
          entry.name === nextCurrent.name &&
          entry.startDate === nextCurrent.startDate &&
          entry.endDate === nextCurrent.endDate &&
          Number(entry.price) === Number(nextCurrent.price),
      );
      if (!alreadyTracked) {
        history.push({
          id: `${Date.now()}`,
          name: nextCurrent.name,
          description: nextCurrent.description || "",
          price: nextCurrent.price,
          startDate: nextCurrent.startDate,
          endDate: nextCurrent.endDate,
          enabledAt: new Date().toISOString(),
        });
      }
    }

    const sale = {
      current: nextCurrent,
      history,
    };
    await writeSale(sale);
    res.status(200).json(sale);
  } catch (error) {
    res.status(500).json({ message: "Failed to update sale config." });
  }
});

app.post("/uploads/github", requireAdmin, async (req, res) => {
  try {
    const config = getGithubConfig();
    if (!config) {
      return res
        .status(500)
        .json({ message: "GitHub storage is not configured." });
    }

    const { dataUrl, filename } = req.body;
    const { base64, extension } = parseImageDataUrl(dataUrl);
    const filePath = buildImagePath(config.basePath, filename, extension);

    const apiUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${filePath}?branch=${config.branch}`;
    const response = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "xypht-backend",
      },
      body: JSON.stringify({
        message: `Upload ${filePath}`,
        content: base64,
        branch: config.branch,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        message: "Failed to upload image to GitHub.",
        details: errorBody,
      });
    }

    const payload = await response.json();
    const url =
      payload?.content?.download_url ||
      buildRawUrl(config, payload?.content?.path || filePath);

    res.status(201).json({ url, path: payload?.content?.path || filePath });
  } catch (error) {
    res.status(500).json({ message: "Failed to upload image." });
  }
});

const sanitizeImages = (images) => {
  if (!Array.isArray(images)) {
    return [];
  }

  return images
    .map((img) => (typeof img === "string" ? img.trim() : ""))
    .filter(Boolean);
};

const sanitizeBrand = (brand) => {
  if (typeof brand !== "string") {
    return "";
  }

  return brand.trim();
};

const sanitizeCategory = (_category) => "Shoes";

const sanitizeSizes = (sizes) => {
  if (!Array.isArray(sizes)) {
    return [];
  }

  const normalized = sizes
    .map((size) => Number(size))
    .filter((size) => Number.isFinite(size));

  return Array.from(new Set(normalized)).sort((a, b) => a - b);
};

const sanitizeBestSeller = (value) => Boolean(value);

app.post("/products", requireAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      offerPrice,
      images,
      brand,
    category,
      sizes,
      isBestSeller,
    } = req.body;
    const sanitizedImages = sanitizeImages(images);
    const sanitizedBrand = sanitizeBrand(brand);
  const sanitizedCategory = sanitizeCategory(category);
    const sanitizedSizes = sanitizeSizes(sizes);
    const sanitizedBestSeller = sanitizeBestSeller(isBestSeller);

    if (!name || !offerPrice || sanitizedImages.length === 0) {
      return res
        .status(400)
        .json({ message: "Name, offerPrice, and images are required." });
    }

    const products = await readProducts();
    const newProduct = {
      id: Date.now().toString(),
      name,
      description: description || "",
      price: Number(price) || Number(offerPrice),
      offerPrice: Number(offerPrice),
      images: sanitizedImages,
      brand: sanitizedBrand,
      category: sanitizedCategory,
      sizes: sanitizedSizes,
      isBestSeller: sanitizedBestSeller,
    };

    products.push(newProduct);
    await writeProducts(products);

    res.status(201).json(newProduct);
  } catch (error) {
    console.error("Failed to create product.", error);
    res.status(500).json({
      message: "Failed to create product.",
      details: error?.message || String(error),
    });
  }
});

app.put("/products/:id", requireAdmin, async (req, res) => {
  try {
    const products = await readProducts();
    const index = products.findIndex((item) => item.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ message: "Product not found." });
    }

    const current = products[index];
    const updatedImages = sanitizeImages(req.body.images);
    const updatedBrand = sanitizeBrand(req.body.brand);
    const updatedSizes = sanitizeSizes(req.body.sizes);
    const sizesProvided = Array.isArray(req.body.sizes);
    const updatedBestSeller = sanitizeBestSeller(req.body.isBestSeller);
    const updated = {
      ...current,
      ...req.body,
      price: Number(req.body.price ?? current.price),
      offerPrice: Number(req.body.offerPrice ?? current.offerPrice),
      images: updatedImages.length ? updatedImages : current.images,
      brand: updatedBrand || current.brand || "",
      category: "Shoes",
      sizes: sizesProvided ? updatedSizes : current.sizes || [],
      isBestSeller:
        req.body.isBestSeller === undefined
          ? current.isBestSeller || false
          : updatedBestSeller,
    };

    products[index] = updated;
    await writeProducts(products);

    res.json(updated);
  } catch (error) {
    console.error("Failed to update product.", error);
    res.status(500).json({
      message: "Failed to update product.",
      details: error?.message || String(error),
    });
  }
});

app.delete("/products/:id", requireAdmin, async (req, res) => {
  try {
    const products = await readProducts();
    const filtered = products.filter((item) => item.id !== req.params.id);

    if (filtered.length === products.length) {
      return res.status(404).json({ message: "Product not found." });
    }

    await writeProducts(filtered);
    res.json({ message: "Product deleted." });
  } catch (error) {
    console.error("Failed to delete product.", error);
    res.status(500).json({
      message: "Failed to delete product.",
      details: error?.message || String(error),
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
