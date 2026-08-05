import { useEffect, useState } from "react";
import { Calendar, Clock, ArrowRight, Rss } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";

const DEVTO_API =
  "https://dev.to/api/articles?tag=webdev&per_page=6&state=rising";
const CACHE_KEY = "devto_posts_cache";
const CACHE_TTL = 6 * 60 * 60 * 1000;

interface Post {
  id: number;
  title: string;
  excerpt: string;
  url: string;
  date: string;
  readTime: number;
  tags: string[];
}

interface DevToArticle {
  id: number;
  title: string;
  description: string;
  url: string;
  published_at: string;
  reading_time_minutes: number;
  tag_list: string[];
}

const FALLBACK: Post[] = [
  {
    id: 1,
    title: "Optimizing PostgreSQL Queries with Indexes & EXPLAIN ANALYZE",
    excerpt:
      "A practical guide to finding query bottlenecks in PostgreSQL using EXPLAIN ANALYZE, partial indexes, and covering indexes to speed up your database.",
    url: "https://www.postgresql.org/docs/current/performance-tips.html",
    date: new Date().toISOString(),
    readTime: 8,
    tags: ["postgresql", "sql", "backend"],
  },
  {
    id: 2,
    title: "React + TypeScript: Patterns for Scalable Applications",
    excerpt:
      "Best practices for structuring large React + TypeScript codebases: compound components, custom hooks, and strict typing strategies that save time in production.",
    url: "https://react.dev/learn",
    date: new Date().toISOString(),
    readTime: 6,
    tags: ["react", "typescript", "frontend"],
  },
  {
    id: 3,
    title: "Supabase in Production: Row Level Security & Edge Functions",
    excerpt:
      "How to properly configure Row Level Security policies in Supabase, combine them with Edge Functions, and avoid the most common pitfalls in production setups.",
    url: "https://supabase.com/docs",
    date: new Date().toISOString(),
    readTime: 7,
    tags: ["supabase", "backend", "database"],
  },
];

const loadCache = (): Post[] | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { posts, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL) return null;
    return posts;
  } catch {
    return null;
  }
};

const saveCache = (posts: Post[]) => {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ posts, timestamp: Date.now() }),
    );
  } catch {}
};

const fetchFromDevTo = async (): Promise<Post[]> => {
  const res = await fetch(DEVTO_API);
  if (!res.ok) throw new Error(`dev.to ${res.status}`);
  const data: DevToArticle[] = await res.json();
  return data.slice(0, 6).map((a) => ({
    id: a.id,
    title: a.title,
    excerpt: a.description || "",
    url: a.url,
    date: a.published_at,
    readTime: a.reading_time_minutes || 5,
    tags: a.tag_list.slice(0, 3),
  }));
};

const Blog = () => {
  const { t } = useLanguage();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const cached = loadCache();
      if (cached) {
        setPosts(cached);
        setLoading(false);
        fetchFromDevTo()
          .then((fresh) => {
            setPosts(fresh);
            saveCache(fresh);
          })
          .catch(() => {});
        return;
      }
      try {
        const fresh = await fetchFromDevTo();
        setPosts(fresh);
        saveCache(fresh);
      } catch {
        setPosts(FALLBACK);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const renderSkeletons = () =>
    Array.from({ length: 6 }).map((_, i) => (
      <Card key={i} className="flex flex-col animate-pulse">
        <CardHeader>
          <div className="h-4 w-20 bg-muted rounded mb-3" />
          <div className="h-6 w-full bg-muted rounded mb-2" />
          <div className="h-6 w-3/4 bg-muted rounded mb-4" />
          <div className="flex gap-4">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-4 w-16 bg-muted rounded" />
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="space-y-2">
            <div className="h-4 w-full bg-muted rounded" />
            <div className="h-4 w-5/6 bg-muted rounded" />
          </div>
        </CardContent>
        <CardFooter>
          <div className="h-10 w-full bg-muted rounded" />
        </CardFooter>
      </Card>
    ));

  return (
    <div className="min-h-screen py-24">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-16 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {t("blog.title")}
          </h1>
          <p className="text-xl text-muted-foreground mb-4">
            {t("blog.subtitle")}
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Rss className="h-4 w-4 text-primary" />
            <span>
              {t("blog.poweredBy")}{" "}
              <a
                href="https://dev.to"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                DEV Community
              </a>
            </span>
          </div>
        </div>

        <div className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loading && renderSkeletons()}

          {!loading &&
            posts.map((post, index) => (
              <Card
                key={post.id}
                className="flex flex-col animate-slide-up hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <CardHeader>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {post.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-xs px-2 py-0.5"
                      >
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                  <h3 className="text-lg font-bold mb-2 line-clamp-2 leading-snug">
                    {post.title}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{new Date(post.date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {post.readTime} {t("blog.minutes")}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-muted-foreground text-sm line-clamp-3 leading-relaxed">
                    {post.excerpt}
                  </p>
                </CardContent>
                <CardFooter>
                  <Button asChild variant="ghost" className="w-full group">
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t("blog.readMore")}
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </a>
                  </Button>
                </CardFooter>
              </Card>
            ))}
        </div>
      </div>
    </div>
  );
};

export default Blog;
