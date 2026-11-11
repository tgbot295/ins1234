# 商品目录网站 — 源码版

顾客看的商城 + 管理员后台，同一个网站、同一个域名。
前台就是之前确认过的正式版样子：Mercury 风格排版、默认英文（可切中文）、价格隐藏、每件商品只有「看详情」和 WhatsApp 两个按钮，点 WhatsApp 跳到客服 **+1 (930) 224-0183**。

- 前台：`http://你的域名/`（或本地 `http://localhost:3000`）
- 后台：`http://你的域名/admin`（或本地 `http://localhost:3000/admin`）

## 网站里有什么

| 部分 | 说明 |
|---|---|
| 前台商城 | 顶栏（分类 + 搜索）、品牌分区、商品网格、详情多图画廊（箭头 / 缩略图 / 手机滑动）、中英切换、WhatsApp 跳转 |
| 管理后台 | 密码登录、商品列表、新增 / 编辑 / 删除、上架 / 下架、多图上传（正面 / 侧面 / 细节）、价格（美元 USD，留空 = 前台不显示） |
| 数据 | `data/products.json` 就是数据库，已内置 25 件商品；图片在 `public/images/`，后台新上传的图片在 `public/uploads/` |
| 技术 | Node.js + Express + multer，无构建步骤，不用 TypeScript、不用打包 |

## 改店名 / 改 WhatsApp 号码（只改一个地方）

打开 `config.js`：

```js
storeName: 'M$M',              // 店名
whatsappNumber: '19302240183', // 纯数字，用于 wa.me 跳转
whatsappDisplay: '+1 (930) 224-0183',
```

改完重启网站就全站生效。

## 本地运行（先在自己电脑上试）

### 1. 安装 Node.js 18 或以上

官网 https://nodejs.org 下载 LTS 版安装，装好后在终端输入 `node -v` 能看到版本号就行。

### 2. 安装依赖

```bash
npm install
```

### 3. 设置管理员密码（重要）

```bash
cp .env.example .env
```

然后用记事本打开 `.env`，把 `ADMIN_PASSWORD=968574` 改成你自己的强密码。
不改也可以跑，但**上线前必须改**，默认密码是 `968574`。

### 4. 启动

```bash
npm start
```

看到 `Catalog website running at http://0.0.0.0:3000` 就是跑起来了。

- 前台：http://localhost:3000
- 后台：http://localhost:3000/admin（输入你设的密码登录）

按 `Ctrl + C` 停止。

## 部署到自己的服务器：宝塔面板（推荐，主方法）

> 你只需要：一台装了宝塔面板（Baota / aaPanel）的云服务器 + 一个域名。域名先买好（见最后一步）。

### 第 1 步：宝塔里装好 Node.js 和 PM2

1. 打开宝塔面板 → 左侧 **软件商店**。
2. 搜索安装 **Node.js 版本管理器**（Node version manager），装好后在里面安装 **Node.js 18 或 20**，设为默认版本。
3. 再搜索安装 **PM2 管理器**（PM2 manager）。PM2 的作用是：网站挂了自动重启、服务器重启后自动启动，不用你一直开着终端。

### 第 2 步：上传源码

1. 宝塔左侧 **文件**，进入 `/www/wwwroot/`。
2. 把这个 zip 传上去，解压，得到一个文件夹（比如 `/www/wwwroot/catalog-website-source/`）。
3. 点进文件夹，确认里面有 `server.js`、`package.json`、`public/`、`data/`。

### 第 3 步：安装依赖、启动项目

在宝塔里打开这个文件夹的**终端**（文件页面右上角“终端”，或用 SSH 连服务器），依次执行：

```bash
cd /www/wwwroot/catalog-website-source
npm install
cp .env.example .env
```

然后用编辑器打开 `.env`，把 `ADMIN_PASSWORD=admin123` 改成你自己的密码。

启动方式（二选一，推荐 A）：

**A. 用 PM2 管理器启动（推荐）**

1. 宝塔 → 软件商店 → **PM2 管理器** → 添加项目。
2. 项目目录选 `/www/wwwroot/catalog-website-source`，启动文件选 `server.js`，运行模式默认，点启动。
3. 以后改了代码 / 改了 `config.js`，在 PM2 里点一下「重启」就行。

**B. 用宝塔「Node 项目」启动**

宝塔 → **网站** → **Node 项目** → 添加 Node 项目：项目目录选源码文件夹，启动文件 `server.js`，端口填 `3000`，环境变量里加 `ADMIN_PASSWORD=你的密码`，保存并启动。

> 端口说明：程序默认监听 `process.env.PORT || 3000`，绑定 `0.0.0.0`，宝塔反向代理用 `http://127.0.0.1:3000` 就能连上，不用改代码。

### 第 4 步：宝塔里绑定域名 + 反向代理

1. 宝塔 → **网站** → 添加站点：域名填你买好的域名（比如 `www.yourstore.com`，再加一个不带 www 的 `yourstore.com`），根目录随便填（反向代理后不走这个目录），PHP 版本选“纯静态”即可。
2. 点进这个站点 → **反向代理** → 添加反向代理：
   - 代理名称：随便填，如 `catalog`
   - 目标 URL：`http://127.0.0.1:3000`
   - 发送域名：留空或填你的域名
   - 保存，并确认代理状态是「开启」。
3. 打开 `http://你的域名`，能看到商城就通了；再打开 `http://你的域名/admin`，能打开登录页就对了。

### 第 5 步：开启 HTTPS（SSL 证书，免费）

1. 还是这个站点 → **SSL** → **Let's Encrypt**。
2. 勾选你的域名，点申请。宝塔会自动申请免费证书并开启强制 HTTPS。
3. 申请成功后，访问 `https://你的域名`，浏览器显示小锁就完成了。
   > 注意：Let's Encrypt 申请时域名必须已经解析到这台服务器（下一步），否则申请会失败。

### 第 6 步：域名解析（DNS）

去你买域名的地方（Namecheap / Cloudflare / 阿里云都一样），加一条 A 记录：

| 主机记录 | 记录类型 | 记录值 |
|---|---|---|
| @ | A | 你服务器的公网 IP |
| www | A | 你服务器的公网 IP |

等几分钟到几小时生效（一般几分钟），然后用 `https://你的域名` 打开检查。

### 第 7 步：图片上传目录权限

后台上传的图片存在 `public/uploads/`，如果上传时报错、或上传后图片打不开，按下面检查：

1. 宝塔 → 文件 → 进入 `/www/wwwroot/catalog-website-source/public/`。
2. 选中 `uploads` 文件夹 → 权限，设为 `755`，所有者设为 `www`（宝塔默认的网站运行用户），勾选「应用到子目录和文件」。
3. 同样检查 `data/` 文件夹也是 `755`、所有者 `www`，否则后台保存商品时会写不进 `data/products.json`。
4. 回到 PM2 管理器重启一次项目，再试上传。

### 宝塔日常维护

- **改店名 / WhatsApp 号码**：改 `config.js`，PM2 里重启项目。
- **改管理员密码**：改 `.env` 里的 `ADMIN_PASSWORD`，PM2 里重启项目。
- **备份**：定期在宝塔文件里把整个源码文件夹打包下载，重点是 `data/products.json`（全部商品数据）和 `public/uploads/`（后台上传的图片）。
- **网站打不开**：先看 PM2 管理器里项目是不是「运行中」，不是就点启动；再看反向代理的目标是不是 `http://127.0.0.1:3000`。

## 备选：不用宝塔的 VPS（pm2 命令行，简短版）

如果你不用宝塔、直接用命令行管理服务器：

```bash
# 服务器上装 Node 18+ 后
cd /www/wwwroot/catalog-website-source
npm install
cp .env.example .env   # 改掉 ADMIN_PASSWORD
npm install -g pm2
pm2 start server.js --name catalog
pm2 save && pm2 startup   # 开机自启
```

再用 nginx 把域名反向代理到 `http://127.0.0.1:3000`，并用 certbot 申请 Let's Encrypt 证书。能用宝塔的话直接用上面宝塔的方法，更简单。

## 后台使用方法

1. 打开 `/admin`，输入管理员密码登录。
2. **新增商品**：点「+ 新增商品」，填中文名、英文名、品牌、分类、编号（唯一，不能重复），价格填美元数字或留空（留空 = 前台不显示价格），点「选择文件」选多张图片 → 点「上传选中图片」→ 点「保存」。
3. **编辑商品**：列表里点「编辑」，可以换图（点图片右上角 ✕ 删掉）、改价、上架 / 下架。
4. **下架**：取消「上架」勾选并保存，前台就看不到这件商品了，数据还在，随时能再上架。
5. **删除**：列表里点「删除」，只删商品记录，不删图片文件。

## 文件结构

```
catalog-website-source/
├── server.js            # 后端：Express + 上传 + 管理员登录 + API
├── config.js            # 店名 / WhatsApp 号码（只改这里）
├── package.json         # 依赖：express + multer
├── .env.example         # 复制成 .env，填管理员密码和端口
├── .gitignore
├── README.md            # 本文件
├── data/
│   └── products.json    # 数据库：25 件种子商品
└── public/
    ├── index.html       # 前台页面
    ├── app.js           # 前台逻辑（中英切换、搜索、详情画廊）
    ├── styles.css       # 前台样式
    ├── admin.html       # 后台页面
    ├── admin.js         # 后台逻辑
    ├── images/          # 种子商品图（25 件 + Kelly Mini 3 张多角度图）
    └── uploads/         # 后台上传的图片存在这里（.gitkeep 占位）
```

## 常见问题

- **本地 `npm start` 报错找不到模块**：先跑 `npm install`，再跑 `npm start`。
- **后台登录提示密码错误**：检查 `.env` 里的 `ADMIN_PASSWORD`，改完要重启（本地按 `Ctrl+C` 再 `npm start`；宝塔在 PM2 里点重启）。
- **前台图片打不开**：确认 `public/images/` 里有图片文件；后台上传的图片在 `public/uploads/`，按上面第 7 步检查权限。
- **端口被占用**：`PORT=3001 npm start` 换个端口；宝塔里反向代理目标也要改成 `http://127.0.0.1:3001`。
