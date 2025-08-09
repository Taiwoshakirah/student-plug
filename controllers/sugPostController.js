const SugPost = require("../models/sugPost");
const { promisify } = require("util");
const cloudinary = require("cloudinary");
const { uploadToCloudinary } = require("../config/cloudinaryConfig");
const fs = require("fs");
const mongoose = require("mongoose");
const Roles = require("../middlewares/role");
const User = require("../models/signUp");
const SugUser = require("../models/schoolSug");
const {
  Types: { ObjectId },
} = require("mongoose");
const SchoolInfo = require("../models/schoolInfo");
const UserPost = require("../models/post");
const { sendNotification } = require("../utils/websocket");
const Comment = require("../models/allComment");
const { extractHashtags } = require("./trendingController");
const EventEmitter = require("events");
const postEventEmitter = new EventEmitter();

const createSugPost = async (req, res) => {
  const { adminId, text, schoolInfoId } = req.body;

  if (!adminId || !schoolInfoId) {
    return res
      .status(400)
      .json({ message: "Admin ID, and schoolInfoId are required" });
  }

  // Ensure either text or image(s) is provided
  if (!text && !(req.files && req.files.image)) {
    return res
      .status(400)
      .json({ message: "You must provide either text, image(s), or both" });
  }

  try {
    let imageUrls = [];

    if (req.files && req.files.image) {
      const images = Array.isArray(req.files.image)
        ? req.files.image
        : [req.files.image];
      for (const image of images) {
        const tempFilePath = `uploads/${image.name}`;
        await image.mv(tempFilePath);
        const result = await uploadToCloudinary(tempFilePath);
        if (result && result.secure_url) {
          imageUrls.push(result.secure_url);
        }
        fs.unlinkSync(tempFilePath); // Clean up temporary file
      }
    }

    // Extract hashtags and check for trending hashtags
    const processedText = text || ""; 
    const hashtags = extractHashtags(processedText);
    const trendingHashtags = ["#trending", "#viral"]; 
    const isTrending = hashtags.some((hashtag) =>
      trendingHashtags.includes(hashtag.toLowerCase())
    );

    // Create post
    const post = new SugPost({
      adminId,
      text: processedText,
      images: imageUrls,
      schoolInfoId,
      trending: processedText.includes("#"), 
    });
    await post.save();

    const populatedPost = await SugPost.findById(post._id)
      .populate("schoolInfoId", "university uniProfilePicture")
      .populate("adminId", "sugFullName email");

    // Emit an event for new SUG posts
    postEventEmitter.emit("newPost", {
      message: "New SUG post available!",
      post: {
        text: populatedPost.text,
        images: populatedPost.images,
        schoolInfo: populatedPost.schoolInfoId,
        admin: populatedPost.adminId,
      },
    });


    res.status(201).json({ message: "Post created", post: populatedPost });
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ message: "Error creating post", error });
  }
};


const isValidObjectId = (id) => {
  return ObjectId.isValid(id) && new ObjectId(id).equals(id);
};

const { Notification } = require("../models/notification");
const { sendNotificationToPostOwner } = require("../utils/websocket");


const toggleLike = async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId, adminId } = req.body;

    if (!userId && !adminId) {
      return res.status(400).json({ message: "Invalid liker ID" });
    }

    const likerId = userId || adminId;

    // Fetch the post (from UserPost or SugPost collections)
    const post =
      (await UserPost.findById(postId)) || (await SugPost.findById(postId));
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check if already liked
    const alreadyLikedIndex = post.likes.findIndex(
      (like) =>
        like && like._id && like._id.toString && like._id.toString() === likerId
    );

    let likerName = "Unknown Liker";
    let likerPhoto = null;

    // Fetch the full name and profile photo of the liker
    if (userId) {
      const liker = await User.findById(userId);
      if (liker) {
        likerName = liker.fullName;
        likerPhoto = liker.profilePhoto || null;
      }
    } else if (adminId) {
        const liker = await SugUser.findById(adminId);
        if (liker) {
          likerName = liker.sugFullName || "Admin";
          const schoolInfo = await SchoolInfo.findOne({ userId: new mongoose.Types.ObjectId(adminId) });
          likerPhoto = schoolInfo?.uniProfilePicture || null;
        }
      }

    if (alreadyLikedIndex !== -1) {
      // Remove like if already liked
      post.likes.splice(alreadyLikedIndex, 1);
    } else {
      // Add like if not already liked
      post.likes.push({
        _id: likerId,
        fullName: likerName,
        profilePhoto: likerPhoto,
        createdAt: new Date(),
      });
    }

    await post.save();

    // Find post owner ID (user or admin)
    const postOwnerId =
      post.user && post.user._id
        ? post.user._id.toString()
        : post.adminId && post.adminId._id
        ? post.adminId._id.toString()
        : null;

    if (!postOwnerId) {
      return res.status(400).json({ message: "Post owner not found" });
    }

    // Send notification to the post owner if liked/unliked by someone else
    if (postOwnerId && postOwnerId !== likerId) {
      // Adjust notification for the liker
      
    //   console.log("Admin data before creating notification:", adminMap.get(likerId));
   console.log("Liker name before notification:", likerName);
   console.log("Liker photo before notification:", likerPhoto);

   if (postOwnerId && postOwnerId !== likerId) {
   try {
  const notification = {
    userId: postOwnerId,
    title: `Your post was ${alreadyLikedIndex !== -1 ? "unliked" : "liked"}!`,
    body: `${likerName} has ${alreadyLikedIndex !== -1 ? "unliked" : "liked"} your post.`,
    postId: post._id,
    likerName: likerName || "Unknown Liker",
    likerPhoto: likerPhoto || null,
    read: false,
    type: "like",
  };

  console.log("Notification object to save:", notification);

  // Send notification immediately via WebSocket
  sendNotificationToPostOwner(postOwnerId, notification);

  // Save the notification for later
  const newNotification = new Notification(notification);
  await newNotification.save();

  console.log("Notification saved successfully.");
} catch (error) {
  console.error("Error creating notification:", error);
}
}

    }

    // Fetch liker details to update response
    const likerIds = post.likes.map((like) => like && like._id).filter(Boolean);
    const users = await User.find({ _id: { $in: likerIds } });
    const admins = await SugUser.find({ _id: { $in: likerIds } });

    const userMap = new Map(
      users.map((user) => [
        user._id.toString(),
        { fullName: user.fullName, profilePhoto: user.profilePhoto },
      ])
    );
    const adminData = await Promise.all(
      admins.map(async (admin) => {
        const schoolInfo = await SchoolInfo.findOne({ userId: admin._id });
        console.log("Admin ID:", admin._id, "SchoolInfo:", schoolInfo);
        return [
          admin._id.toString(),
          {
            fullName: admin.sugFullName || "Unknown Admin",
            profilePhoto: schoolInfo ? schoolInfo.uniProfilePicture : null,
          },
        ];
      })
    );

    const adminMap = new Map(adminData);

    console.log("Admin Map:", Array.from(adminMap.entries()));

    const updatedLikes = post.likes.map((like) => {
      if (!like || !like._id) {
        return {
          userId: null,
          fullName: "Unknown Liker",
          profilePhoto: null,
          liked: true,
          createdAt: null,
        };
      }
      const likeId = like._id.toString();
      const likerInfo = userMap.get(likeId) ||
        adminMap.get(likeId) || {
          fullName: "Unknown Liker",
          profilePhoto: null,
        };

      return {
        userId: like._id,
        fullName: likerInfo.fullName,
        profilePhoto: likerInfo.profilePhoto,
        liked: true,
        createdAt: like.createdAt || null,
      };
    });

    console.log("Updated Likes:", updatedLikes);

    // console.log(`Updated likes for post ${post._id}:`, post.likes);

    res.status(200).json({
      message: "Post like toggled",
      likesCount: post.likes.length,
      likesArray: updatedLikes,
      userLiked: !!userId && alreadyLikedIndex === -1,
      adminLiked: !!adminId && alreadyLikedIndex === -1,
      allLikes: updatedLikes,
    });
  } catch (error) {
    console.error("Error toggling like:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


const addComment = async (req, res) => {
  const { postId } = req.params;
  const { text, userId, parentCommentId, isAdmin } = req.body;

  try {
    if (!postId || !userId || !text) {
      return res
        .status(400)
        .json({ message: "postId, userId, and text are required." });
    }

    // Validate if the post exists
    let post = isAdmin
      ? await SugPost.findById(postId)
      : await UserPost.findById(postId);

    if (!post) {
      return res.status(404).json({ message: "Post not found." });
    }

    // Check if commenter is a regular user
    let commenter = await User.findById(userId).select("fullName profilePhoto");
    let isCommenterAdmin = false;

    if (!commenter) {
      // If not found in User collection, check in SugUser
      commenter = await SugUser.findById(userId)
        .populate({
          path: "schoolInfo",
          model: "SchoolInfo",
          select: "uniProfilePicture",
        })
        .select("sugFullName schoolInfo");
      isCommenterAdmin = !!commenter;
    }

    if (!commenter) {
      return res.status(404).json({ message: "Commenter not found." });
    }

    // Prepare comment data
    const commentData = {
      post: postId,
      text,
      parentComment: parentCommentId || null,
      isAdmin, // Pass isAdmin from request body
      user: userId,
    };

    const newComment = await Comment.create(commentData);

    // Add replies if parent comment exists
    if (parentCommentId) {
      await Comment.findByIdAndUpdate(parentCommentId, {
        $push: { replies: newComment._id },
      });
    }

    // Format commenter details
    const commenterDetails = isCommenterAdmin
      ? {
          _id: commenter._id,
          fullName: commenter.sugFullName,
          profilePhoto: commenter.schoolInfo?.uniProfilePicture || null,
        }
      : {
          _id: commenter._id,
          fullName: commenter.fullName,
          profilePhoto: commenter.profilePhoto || null,
        };

    const commenterPhoto = isCommenterAdmin
      ? commenter.schoolInfo?.uniProfilePicture || "" 
      : commenter.profilePhoto || ""; 

      if (post.user && post.user.toString() !== userId) {
    const commentNotification = {
      userId: post.user || post.adminId, 
      postId,
      title: "New Comment",
      body: `${
        commenter.fullName || commenter.sugFullName
      } commented on your post.`,
      likerName: commenter.fullName || commenter.sugFullName, 
      likerPhoto: commenterPhoto || "", 
      type: "comment", 
      commentId: newComment._id, 
      createdAt: new Date(),
    };

    const newCommentNotification = await Notification.create(
      commentNotification
    );

    // Send WebSocket notification to the post owner
    if (post.user) {
      sendNotificationToPostOwner(post.user, newCommentNotification);
    }
}

    // Send WebSocket notification to the parent comment owner (if applicable)
    if (parentCommentId) {
      const parentComment = await Comment.findById(parentCommentId).select(
        "user admin"
      );
      const ownerId = parentComment.admin || parentComment.user;

      if (ownerId && ownerId.toString() !== userId) {
        const replyNotification = {
          userId: ownerId,
          postId,
          title: "New Reply",
          body: `${commenter.fullName || "Someone"} replied to your comment.`,
          likerName: commenter.fullName || "Someone", 
          likerPhoto: commenterPhoto || "", 
          type: "comment",
          commentId: newComment._id, 
          createdAt: new Date(),
        };

        await Notification.create(replyNotification); 
        sendNotificationToPostOwner(ownerId, replyNotification);
      }
    }

    // Return the formatted response
    res.status(201).json({
      message: "Comment added successfully",
      comment: {
        post: newComment.post,
        text: newComment.text,
        user: commenterDetails,
        isAdmin, 
        parentComment: newComment.parentComment,
        replies: newComment.replies,
        _id: newComment._id,
        createdAt: newComment.createdAt,
        __v: newComment.__v,
      },
    });
  } catch (error) {
    console.error("Error adding comment:", error.message || error);
    res.status(500).json({
      message: "Error adding comment",
      error: error.message || error,
    });
  }
};



const fetchComments = async (req, res) => {
    const { postId } = req.params;
  
    try {
      // First fetch the comments without population
      const comments = await Comment.find({ post: postId, parentComment: null });
  
      if (!comments.length) {
        return res.status(404).json({ message: "No comments found for this post." });
      }
  
      // Process each comment to get the correct user details
      const populatedComments = await Promise.all(comments.map(async (comment) => {
        const commentObj = comment.toObject();
  
        // First try to find user in regular Users collection
        let userDetails = await User.findById(commentObj.user)
          .select('fullName profilePhoto')
          .lean();
  
        // If not found in Users, try SugUsers collection
        if (!userDetails) {
          const adminUser = await SugUser.findById(commentObj.user)
            .select('sugFullName')
            .populate({
              path: 'schoolInfo',
              model: 'SchoolInfo',
              select: 'uniProfilePicture'
            })
            .lean();
  
          if (adminUser) {
            userDetails = {
              _id: adminUser._id,
              fullName: adminUser.sugFullName,
              profilePhoto: adminUser.schoolInfo?.uniProfilePicture || null,
              isAdmin: true
            };
          }
        } else {
          // Format regular user details
          userDetails = {
            _id: userDetails._id,
            fullName: userDetails.fullName,
            profilePhoto: userDetails.profilePhoto || null,
            isAdmin: false
          };
        }
  
        // Assign the user details
        commentObj.user = userDetails;
  
        // Handle replies if they exist
        if (commentObj.replies && commentObj.replies.length > 0) {
          // Fetch and populate all replies
          const populatedReplies = await Promise.all(
            commentObj.replies.map(async (replyId) => {
              const reply = await Comment.findById(replyId).lean();
              if (!reply) return null;
  
              // First check Users collection for reply author
              let replyUser = await User.findById(reply.user)
                .select('fullName profilePhoto')
                .lean();
  
              // If not found, check SugUsers collection
              if (!replyUser) {
                const adminReplyUser = await SugUser.findById(reply.user)
                  .select('sugFullName')
                  .populate({
                    path: 'schoolInfo',
                    model: 'SchoolInfo',
                    select: 'uniProfilePicture'
                  })
                  .lean();
  
                if (adminReplyUser) {
                  replyUser = {
                    _id: adminReplyUser._id,
                    fullName: adminReplyUser.sugFullName,
                    profilePhoto: adminReplyUser.schoolInfo?.uniProfilePicture || null,
                    isAdmin: true
                  };
                }
              } else {
                replyUser = {
                  _id: replyUser._id,
                  fullName: replyUser.fullName,
                  profilePhoto: replyUser.profilePhoto || null,
                  isAdmin: false
                };
              }
  
              return {
                ...reply,
                user: replyUser
              };
            })
          );
  
          commentObj.replies = populatedReplies.filter(reply => reply !== null);
        }
  
        return commentObj;
      }));
  
      res.status(200).json({ comments: populatedComments });
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ message: "Error fetching comments", error: error.message });
    }
  };
  
  
  
  
  


const fetchPostDetails = async (req, res) => {
  try {
    const { adminId } = req.params;

    console.log("Admin ID:", adminId);

    if (!adminId) {
      return res.status(400).json({ message: "Admin ID is required" });
    }

    const adminObjectId = new mongoose.Types.ObjectId(adminId);

    const posts = await SugPost.find({ adminId: adminObjectId })
      .populate({
        path: "adminId",
        select: "sugFullName email",
        populate: {
          path: "schoolInfo",
          model: "SchoolInfo",
          select: "uniProfilePicture",
        },
      })
      .populate({
        path: "likes",
        model: "User",
        select: "_id fullName",
      })
      .populate({
        path: "comments",
        select: "text userId createdAt isAdmin",
        populate: {
          path: "userId",
          model: "User",
          select: "_id fullName",
        },
      })
      .sort({ createdAt: -1 })
      .lean();

    if (posts.length === 0) {
      return res
        .status(404)
        .json({ message: "No posts found for this admin." });
    }

    const processedPosts = posts.map((post) => {
      // Check if admin has liked the post
      const adminLiked = post.likes.some((like) =>
        like._id.equals(adminObjectId)
      );

      return {
        ...post,
        adminLiked,
        commentsCount: post.comments.length,
        likesCount: post.likes.length,
        comments: post.comments.map((comment) => ({
          ...comment,
          isAdmin: comment.isAdmin || false,
        })),
        // Add `profilePicture` from `uniProfilePicture`
        profilePicture: post.adminId?.schoolInfo?.uniProfilePicture || "",
      };
    });

    res.json({ posts: processedPosts });
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ message: "Error fetching posts", error });
  }
};

const fetchPostsForSchool = async (req, res) => {
    console.log("req.user:", req.user); 
  const { schoolInfoId } = req.params;
  const { page = 1, limit = 10 } = req.query; 

  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized: User not authenticated" });
}

  const currentUserId = req.user.userId; 
if (!currentUserId) {
  console.warn("currentUserId is not defined. Make sure authentication middleware is in place.");
  return res.status(401).json({ message: "Unauthorized: User not authenticated" });
}



  console.log("Received schoolInfoId:", schoolInfoId);

  if (!mongoose.Types.ObjectId.isValid(schoolInfoId)) {
    return res.status(400).json({ message: "Invalid schoolInfoId" });
  }

  try {
    // Fetching school information
    const schoolInfo = await SchoolInfo.findById(schoolInfoId)
      .select("university state aboutUniversity userId uniProfilePicture")
      .populate({
        path: "userId",
        model: "User",
        select: "fullName email",
      })
      .lean();

    if (!schoolInfo) {
      return res.status(404).json({ message: "School not found" });
    }

    const adminPosts = await SugPost.find({ schoolInfoId })
      .populate([
        {
          path: "adminId",
          model: "SugUser",
          select: "sugFullName email role",
          populate: {
            path: "schoolInfo",
            model: "SchoolInfo",
            select: "university uniProfilePicture",
          },
        },
        {
          path: "comments",
          model: "Comment",
          populate: [
            { path: "user", model: "User", select: "fullName profilePhoto" },
            { path: "admin", model: "SugUser", select: "sugFullName" },
            {
              path: "replies",
              model: "Comment",
              populate: [
                {
                  path: "user",
                  model: "User",
                  select: "fullName profilePhoto",
                },
                { path: "admin", model: "SugUser", select: "sugFullName" },
              ],
            },
          ],
        },
      ])
      .sort({ createdAt: -1 })
      .lean();

    
    const adminPostsWithDetails = adminPosts.map((post) => ({
        ...post,
        postType: "admin",
        isAdmin: post.adminId?.role === "admin",
        isLike: Array.isArray(post.likes) && post.likes.some(like => like._id.toString() === currentUserId.toString()), // Updated logic
        userId: {
          id: post.adminId?._id || "",
          university: post.adminId?.schoolInfo?.university || "",
          schoolInfo: {
            id: post.adminId?.schoolInfo?._id || "",
            university: post.adminId?.schoolInfo?.university || "",
          },
          profilePicture: post.adminId?.schoolInfo?.uniProfilePicture || "",
        },
      }));
      
    

    // Fetch student posts (no pagination applied here)
    const studentPosts = await UserPost.find({ schoolInfoId })
      .populate([
        {
          path: "user",
          model: "User",
          select: "fullName email profilePhoto",
          populate: [
            {
              path: "studentInfo",
              model: "StudentInfo",
              select: "faculty department",
            },
            { path: "schoolInfoId", model: "SchoolInfo", select: "university" },
          ],
        },
        {
          path: "comments",
          model: "Comment",
          populate: [
            { path: "user", model: "User", select: "fullName profilePhoto" },
            { path: "admin", model: "SugUser", select: "sugFullName" },
            {
              path: "replies",
              model: "Comment",
              populate: [
                {
                  path: "user",
                  model: "User",
                  select: "fullName profilePhoto",
                },
                { path: "admin", model: "SugUser", select: "sugFullName" },
              ],
            },
          ],
        },
      ])
      .sort({ createdAt: -1 })
      .lean();

    // Format student posts
    const studentPostsWithDetails = studentPosts.map((post) => ({
        ...post,
        postType: "student",
        isLike: Array.isArray(post.likes) && post.likes.some(like => like._id.toString() === currentUserId.toString()), // Updated logic
        userId: {
          id: post.user?._id || "",
          university: post.user?.schoolInfoId?.university || "",
          schoolInfo: {
            id: post.user?.schoolInfoId?._id || "",
            university: post.user?.schoolInfoId?.university || "",
          },
          profilePicture: post.user?.profilePhoto || "",
        },
        faculty: post.user?.studentInfo?.faculty || "",
        department: post.user?.studentInfo?.department || "",
      }));
   

    // Combine posts
    const allPosts = [...adminPostsWithDetails, ...studentPostsWithDetails];

    // Sort combined posts by creation date
    allPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply pagination on the combined posts
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const paginatedPosts = allPosts.slice(
      (pageNumber - 1) * limitNumber,
      pageNumber * limitNumber
    );

    // Total post count
    const totalPosts = allPosts.length;

    // Response
    res.json({
      schoolInfo,
      posts: paginatedPosts, 
      totalPosts,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalPosts / limitNumber),
    });
  } catch (error) {
    console.error("Error fetching school info and posts:", error);
    res
      .status(500)
      .json({ message: "Error fetching school info and posts", error });
  }
};



const deletePost = async (req, res) => {
  const { postId } = req.params;
  const { userId, role } = req.user;

  console.log("Post ID from params:", postId);

  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({ message: "Invalid Post ID format" });
  }

  let postModel;
  if (role === Roles.ADMIN) {
    console.log(
      "Admin role detected, checking both UserPost and SugPost models."
    );
    postModel = [UserPost, SugPost];
  } else {
    console.log("Regular user role detected, checking UserPost model.");
    postModel = UserPost;
  }

  try {
    let post;

    if (Array.isArray(postModel)) {
      post =
        (await postModel[0].findById(postId)) ||
        (await postModel[1].findById(postId));
    } else {
      post = await postModel.findById(postId);
    }

    console.log("Found post:", post);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const isAuthorized =
      role === Roles.ADMIN || post.user.toString() === userId.toString();
    if (!isAuthorized) {
      return res
        .status(403)
        .json({ message: "Unauthorized to delete this post" });
    }

    await Comment.deleteMany({ post: postId });

    if (post.images && post.images.length > 0) {
      for (const imageUrl of post.images) {
        const publicId = imageUrl.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(publicId);
      }
    }

    await post.deleteOne();

    res
      .status(200)
      .json({ message: "Post and associated comments deleted successfully" });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({ message: "Failed to delete post", error });
  }
};

module.exports = {
  createSugPost,
  toggleLike,
  addComment,
  fetchComments,
  fetchPostDetails,
  fetchPostsForSchool,
  deletePost,
};
