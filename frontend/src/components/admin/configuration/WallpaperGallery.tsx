import {
  Accordion,
  ActionIcon,
  AspectRatio,
  Badge,
  Box,
  Button,
  FileButton,
  List,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  UnstyledButton,
} from "@mantine/core";
import { useModals } from "@mantine/modals";
import { useEffect, useState } from "react";
import { TbCheck, TbTrash, TbUpload } from "react-icons/tb";
import useTranslate from "../../../hooks/useTranslate.hook";
import wallpaperService, {
  Wallpaper,
} from "../../../services/wallpaper.service";
import { byteToHumanSizeString } from "../../../utils/fileSize.util";
import toast from "../../../utils/toast.util";

// the detailed landscapes are 4K pictures, as vectors with that many shapes
// they would take the browser seconds to draw behind every page
const BUILT_IN: { file: string; width?: number; height?: number }[] = [
  { file: "alpine-lake-day.webp", width: 3840, height: 2160 },
  { file: "alpine-lake-dusk.webp", width: 3840, height: 2160 },
  { file: "alpine-lake-night.webp", width: 3840, height: 2160 },
  { file: "dunes.svg" },
  { file: "lagoon.svg" },
  { file: "meadow.svg" },
  { file: "midnight.svg" },
];
const MAX_SIZE = { image: 20 * 1024 * 1024, video: 60 * 1024 * 1024 };
const REQUIREMENTS = { image: 4, video: 5 };

export type Quality =
  "vector" | "uhd" | "qhd" | "fhd" | "small" | "portrait" | "unknown";

// how well a wallpaper covers a large screen, judged by what it would be
// stretched over: 4K monitors and high density laptops
export const wallpaperQuality = (
  width?: number,
  height?: number,
  vector = false,
): Quality => {
  if (vector) return "vector";
  if (!width || !height) return "unknown";
  if (height > width) return "portrait";
  if (width >= 3840 && height >= 2160) return "uhd";
  if (width >= 2560 && height >= 1440) return "qhd";
  if (width >= 1920 && height >= 1080) return "fhd";
  return "small";
};

const QUALITY_COLOR: Record<Quality, string> = {
  vector: "green",
  uhd: "green",
  qhd: "blue",
  fhd: "yellow",
  small: "red",
  portrait: "orange",
  unknown: "gray",
};

type Tile = {
  url: string;
  preview: string;
  name: string;
  vector?: boolean;
  width?: number;
  height?: number;
  wallpaper?: Wallpaper;
};

const WallpaperGallery = ({
  kind,
  value,
  onChange,
  disabled,
}: {
  kind: "image" | "video";
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}) => {
  const t = useTranslate();
  const modals = useModals();
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [uploading, setUploading] = useState(false);
  // a video's size is only known once the browser has read its header
  const [videoSizes, setVideoSizes] = useState<
    Record<string, { width: number; height: number }>
  >({});

  useEffect(() => {
    wallpaperService
      .list()
      .then(setWallpapers)
      .catch(() => undefined);
  }, []);

  const tiles: Tile[] = [
    ...(kind === "image"
      ? BUILT_IN.map(({ file, width, height }) => ({
          url: `/wallpapers/${file}`,
          preview: `/wallpapers/${file}`,
          name: t(`admin.wallpapers.built-in.${file.split(".")[0]}`),
          width,
          height,
          vector: file.endsWith(".svg"),
        }))
      : []),
    ...wallpapers
      .filter((wallpaper) => wallpaper.kind === kind)
      .map((wallpaper) => ({
        url: wallpaper.url,
        preview: wallpaper.thumbnailUrl ?? wallpaper.url,
        name: wallpaper.name,
        width: wallpaper.width ?? videoSizes[wallpaper.url]?.width,
        height: wallpaper.height ?? videoSizes[wallpaper.url]?.height,
        wallpaper,
      })),
  ];

  const upload = async (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_SIZE[kind]) {
      toast.error(
        t("admin.wallpapers.too-large", {
          max: byteToHumanSizeString(MAX_SIZE[kind]),
        }),
      );
      return;
    }
    setUploading(true);
    try {
      const wallpaper = await wallpaperService.upload(file);
      setWallpapers((all) => [wallpaper, ...all]);
      onChange(wallpaper.url);
    } catch (e) {
      toast.axiosError(e);
    } finally {
      setUploading(false);
    }
  };

  const confirmRemove = (wallpaper: Wallpaper) =>
    modals.openConfirmModal({
      title: t("admin.wallpapers.delete.title"),
      children: (
        <Text size="sm">
          {t("admin.wallpapers.delete.description", { name: wallpaper.name })}
        </Text>
      ),
      labels: {
        confirm: t("common.button.delete"),
        cancel: t("common.button.cancel"),
      },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await wallpaperService.remove(wallpaper.file);
          setWallpapers((all) => all.filter((w) => w.file !== wallpaper.file));
          if (value === wallpaper.url) onChange("");
        } catch (e) {
          toast.axiosError(e);
        }
      },
    });

  return (
    <Stack spacing="sm">
      {tiles.length > 0 ? (
        <SimpleGrid
          cols={2}
          spacing="sm"
          breakpoints={[{ maxWidth: "xs", cols: 1 }]}
        >
          {tiles.map((tile) => {
            const selected = value === tile.url;
            const quality = wallpaperQuality(
              tile.width,
              tile.height,
              tile.vector,
            );
            return (
              <Box key={tile.url} sx={{ position: "relative" }}>
                <UnstyledButton
                  onClick={() => onChange(tile.url)}
                  disabled={disabled}
                  aria-pressed={selected}
                  sx={(theme) => ({
                    display: "block",
                    width: "100%",
                    overflow: "hidden",
                    borderRadius: theme.radius.md,
                    outline: selected
                      ? `2px solid ${theme.fn.primaryColor()}`
                      : `1px solid ${theme.colorScheme === "dark" ? theme.colors.dark[4] : theme.colors.gray[3]}`,
                    outlineOffset: selected ? 2 : 0,
                  })}
                >
                  <AspectRatio ratio={16 / 9}>
                    {kind === "video" ? (
                      <video
                        src={`${tile.url}#t=0.5`}
                        muted
                        playsInline
                        preload="metadata"
                        onLoadedMetadata={(event) => {
                          const { videoWidth, videoHeight } =
                            event.currentTarget;
                          setVideoSizes((sizes) => ({
                            ...sizes,
                            [tile.url]: {
                              width: videoWidth,
                              height: videoHeight,
                            },
                          }));
                        }}
                      />
                    ) : (
                      <img src={tile.preview} alt="" loading="lazy" />
                    )}
                  </AspectRatio>
                  <Box p={8}>
                    <Text size="sm" weight={600} lineClamp={1}>
                      {tile.name}
                    </Text>
                    <Stack spacing={4} mt={4} align="flex-start">
                      <Badge
                        size="xs"
                        variant="light"
                        color={QUALITY_COLOR[quality]}
                        sx={{ maxWidth: "100%" }}
                      >
                        {t(`admin.wallpapers.quality.${quality}`)}
                      </Badge>
                      <Text size="xs" color="dimmed" lineClamp={1}>
                        {[
                          tile.width && tile.height
                            ? `${tile.width} × ${tile.height}`
                            : null,
                          tile.wallpaper
                            ? byteToHumanSizeString(tile.wallpaper.size)
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "\u00a0"}
                      </Text>
                    </Stack>
                  </Box>
                </UnstyledButton>
                {selected && (
                  <ThemeIcon
                    radius={999}
                    size={22}
                    sx={{ position: "absolute", top: 8, left: 8 }}
                  >
                    <TbCheck size={14} />
                  </ThemeIcon>
                )}
                {tile.wallpaper && (
                  <ActionIcon
                    color="red"
                    variant="filled"
                    size="sm"
                    disabled={disabled}
                    aria-label={t("admin.wallpapers.delete.title")}
                    onClick={() => confirmRemove(tile.wallpaper!)}
                    sx={{ position: "absolute", top: 8, right: 8 }}
                  >
                    <TbTrash size={14} />
                  </ActionIcon>
                )}
              </Box>
            );
          })}
        </SimpleGrid>
      ) : (
        <Text size="sm" color="dimmed">
          {t("admin.wallpapers.empty")}
        </Text>
      )}
      <FileButton
        accept={
          kind === "image"
            ? "image/jpeg,image/png,image/webp"
            : "video/mp4,video/webm"
        }
        onChange={upload}
      >
        {(props) => (
          <Button
            {...props}
            variant="default"
            leftIcon={<TbUpload size={16} />}
            loading={uploading}
            disabled={disabled}
          >
            {t(`admin.wallpapers.upload.${kind}`)}
          </Button>
        )}
      </FileButton>
      <TextInput
        label={t("admin.wallpapers.address")}
        placeholder="https://"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <Accordion variant="contained">
        <Accordion.Item value="requirements">
          <Accordion.Control>
            {t("admin.wallpapers.requirements.title")}
          </Accordion.Control>
          <Accordion.Panel>
            <List size="sm" spacing={6}>
              {Array.from({ length: REQUIREMENTS[kind] }, (_, i) => (
                <List.Item key={i}>
                  {t(`admin.wallpapers.requirements.${kind}.${i + 1}`)}
                </List.Item>
              ))}
            </List>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
};

export default WallpaperGallery;
