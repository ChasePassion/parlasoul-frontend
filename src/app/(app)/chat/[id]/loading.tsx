import ChatLoadingView from "@/components/ChatLoadingView";

/**
 * 路由边界：导航立即发生，Suspense 流式替换。
 * 与 /chat/new、聊天页数据加载共用同一个加载视图，形状一致，替换时零位移。
 */
export default function Loading() {
  return <ChatLoadingView />;
}
