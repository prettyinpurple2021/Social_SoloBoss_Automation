import { db } from '../database/connection';
import { PostModel } from '../models/Post';
import { Platform, PostStatus } from '../types/database';

export interface ContentCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
  userId: string;
  postCount: number;
  avgEngagement: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentTag {
  id: string;
  name: string;
  description?: string;
  userId: string;
  postCount: number;
  avgEngagement: number;
  created