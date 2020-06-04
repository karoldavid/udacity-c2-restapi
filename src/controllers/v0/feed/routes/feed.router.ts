import { Router, Request, Response } from "express";
import { FeedItem } from "../models/FeedItem";
import { requireAuth } from "../../users/routes/auth.router";
import * as AWS from "../../../../aws";

const router: Router = Router();

// Get all feed items
router.get("/", async (req: Request, res: Response) => {
  const items = await FeedItem.findAndCountAll({ order: [["id", "DESC"]] });
  items.rows.map((item) => {
    if (item.url) {
      item.url = AWS.getGetSignedUrl(item.url);
    }
  });
  res.send(items);
});

// GET a specific resource by Primary Key
router.get("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const item = await FeedItem.findByPk(id);

  if (!item) {
    return res
      .status(404)
      .send({ error: true, message: "Item does not exist." });
  }

  res.status(200).send(item);
});

// update a specific resource
router.patch("/:id", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { caption, fileName } = req.body;

  if (!id) {
    res.status(400).send({ error: true, message: "missing id" });
  }

  if (!caption && !fileName) {
    res
      .status(400)
      .send({ error: true, message: "caption or filename must be specified" });
  }

  try {
    const result = await FeedItem.update(
      {
        caption,
        url: fileName,
      },
      { where: { id } }
    );
    res.status(201).send(result);
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .send({ error: true, message: "Failed to update feed item" });
  }
});

// Get a signed url to put a new item in the bucket
router.get(
  "/signed-url/:fileName",
  requireAuth,
  async (req: Request, res: Response) => {
    let { fileName } = req.params;

    const url = AWS.getPutSignedUrl(fileName);
    res.status(201).send({ url: url });
  }
);

// Post meta data and the filename after a file is uploaded
router.post("/", requireAuth, async (req: Request, res: Response) => {
  const caption = req.body.caption;
  const fileName = req.body.url;

  // check Caption is valid
  if (!caption) {
    return res
      .status(400)
      .send({ error: true, message: "Caption is required or malformed" });
  }

  // check Filename is valid
  if (!fileName) {
    return res
      .status(400)
      .send({ error: true, message: "File url is required" });
  }

  const item = await new FeedItem({
    caption: caption,
    url: fileName,
  });

  const saved_item = await item.save();

  saved_item.url = AWS.getGetSignedUrl(saved_item.url);
  res.status(201).send(saved_item);
});

export const FeedRouter: Router = router;
