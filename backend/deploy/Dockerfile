# 极简 Dockerfile（备选形态；主推裸进程 systemd，见 jjb-backend.service）。
#
# 绕开 devbox 外网受限：本地（有外网）交叉编译 linux/amd64 二进制后，docker build 只 COPY 本地产物，
# 不在 devbox apk pull 业务依赖（仅 ca-certificates/tzdata，alpine 基础镜像已含或本地预拉）。
# Go embed 二进制已编译进 migrations（pb_migrations/*.go 的 init 注册），容器内不需 pb_migrations 目录。
#
# build（本地有外网）:
#   GOOS=linux GOARCH=amd64 go build -o pocketbase .
#   docker build -t jjb-backend -f deploy/Dockerfile .
# run:
#   docker run -d --name jjb-backend -p 8090:8090 -v /opt/jjb-backend/pb_data:/pb/pb_data jjb-backend

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata && update-ca-certificates
WORKDIR /pb
COPY pocketbase /pb/pocketbase
COPY config /pb/config
RUN mkdir -p /pb/pb_data && chmod +x /pb/pocketbase
EXPOSE 8090
VOLUME ["/pb/pb_data"]
CMD ["/pb/pocketbase", "serve", "--http", "0.0.0.0:8090", "--dir", "/pb/pb_data"]
