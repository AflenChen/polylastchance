#!/bin/bash
# 自动化部署脚本
# 使用方法: chmod +x deploy.sh && ./deploy.sh

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
APP_DIR="/var/www/polylastchance/eventtimer-nextjs"
APP_NAME="polylastchance"

echo -e "${GREEN}🚀 开始部署 PolyLastChance...${NC}"

# 检查目录是否存在
if [ ! -d "$APP_DIR" ]; then
    echo -e "${RED}❌ 错误: 应用目录不存在: $APP_DIR${NC}"
    echo -e "${YELLOW}提示: 请先克隆代码到服务器${NC}"
    exit 1
fi

cd "$APP_DIR"

# 检查 git 是否可用
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ 错误: git 未安装${NC}"
    exit 1
fi

# 拉取最新代码
echo -e "${YELLOW}📦 拉取最新代码...${NC}"
git pull || {
    echo -e "${RED}❌ Git pull 失败${NC}"
    exit 1
}

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ 错误: Node.js 未安装${NC}"
    exit 1
fi

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ 错误: npm 未安装${NC}"
    exit 1
fi

# 安装依赖
echo -e "${YELLOW}📥 安装依赖...${NC}"
npm install --production=false || {
    echo -e "${RED}❌ 依赖安装失败${NC}"
    exit 1
}

# 构建应用
echo -e "${YELLOW}🔨 构建应用...${NC}"
npm run build || {
    echo -e "${RED}❌ 构建失败${NC}"
    exit 1
}

# 检查 PM2
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  PM2 未安装，跳过重启步骤${NC}"
    echo -e "${YELLOW}提示: 安装 PM2: npm install -g pm2${NC}"
else
    # 重启应用
    echo -e "${YELLOW}🔄 重启应用...${NC}"
    if pm2 list | grep -q "$APP_NAME"; then
        pm2 restart "$APP_NAME" || {
            echo -e "${RED}❌ 重启失败${NC}"
            exit 1
        }
    else
        echo -e "${YELLOW}⚠️  应用未运行，启动应用...${NC}"
        if [ -f "ecosystem.config.js" ]; then
            pm2 start ecosystem.config.js || {
                echo -e "${RED}❌ 启动失败${NC}"
                exit 1
            }
        else
            pm2 start npm --name "$APP_NAME" -- start || {
                echo -e "${RED}❌ 启动失败${NC}"
                exit 1
            }
        fi
    fi
    
    # 显示状态
    echo -e "${GREEN}📊 应用状态:${NC}"
    pm2 status
fi

echo -e "${GREEN}✅ 部署完成！${NC}"
echo -e "${YELLOW}提示: 如果配置了 Nginx，可能需要重新加载: sudo nginx -s reload${NC}"

