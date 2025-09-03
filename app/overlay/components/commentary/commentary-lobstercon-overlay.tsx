import { api } from "@/convex/_generated/api";
import { CommentaryOverlay as CommentaryOverlayType } from "@/convex/types";
import { useQuery } from "convex/react";

export default function CommentaryLobsterconOverlay({
  data,
}: {
  data: CommentaryOverlayType;
}) {
  const tournamentInfo = useQuery(api.tournaments.getTournamentInfo, {
    tournamentId: data.tournamentId,
  });
  const twitter = (
    <svg
      viewBox="0 0 256 209"
      width="24"
      height="24"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid"
      className="inline-block align-middle"
    >
      <path
        d="M256 25.45c-9.42 4.177-19.542 7-30.166 8.27 10.845-6.5 19.172-16.793 23.093-29.057a105.183 105.183 0 0 1-33.351 12.745C205.995 7.201 192.346.822 177.239.822c-29.006 0-52.523 23.516-52.523 52.52 0 4.117.465 8.125 1.36 11.97-43.65-2.191-82.35-23.1-108.255-54.876-4.52 7.757-7.11 16.78-7.11 26.404 0 18.222 9.273 34.297 23.365 43.716a52.312 52.312 0 0 1-23.79-6.57c-.003.22-.003.44-.003.661 0 25.447 18.104 46.675 42.13 51.5a52.592 52.592 0 0 1-23.718.9c6.683 20.866 26.08 36.05 49.062 36.475-17.975 14.086-40.622 22.483-65.228 22.483-4.24 0-8.42-.249-12.529-.734 23.243 14.902 50.85 23.597 80.51 23.597 96.607 0 149.434-80.031 149.434-149.435 0-2.278-.05-4.543-.152-6.795A106.748 106.748 0 0 0 256 25.45"
        fill="#FFFFFF"
      />
    </svg>
  );
  const youtube = (
    <svg
      viewBox="0 0 256 180"
      width="24"
      height="24"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid"
      className="inline-block align-middle"
    >
      <path
        d="M250.346 28.075A32.18 32.18 0 0 0 227.69 5.418C207.824 0 127.87 0 127.87 0S47.912.164 28.046 5.582A32.18 32.18 0 0 0 5.39 28.24c-6.009 35.298-8.34 89.084.165 122.97a32.18 32.18 0 0 0 22.656 22.657c19.866 5.418 99.822 5.418 99.822 5.418s79.955 0 99.82-5.418a32.18 32.18 0 0 0 22.657-22.657c6.338-35.348 8.291-89.1-.164-123.134Z"
        fill="#FFFFFF"
      />
      <path fill="#000000" d="m102.421 128.06 66.328-38.418-66.328-38.418z" />
    </svg>
  );

  return (
    <div className="text-[#fff] w-[1920px] h-[1080px]">
      <div className="absolute top-[940px] right-[1135px] text-right">
        <div className="text-[36px]">{data?.commentatorLeft ?? "N/A"}</div>
        <div className="mt-[-16px]">
          {/* <span>
            {data.commentatorLeftSocialMedia === "twitter"
              ? twitter
              : data.commentatorLeftSocialMedia === "youtube"
                ? youtube
                : ""}
          </span> */}
          <span className="text-[28px] ml-[10px]">
            {data?.commentatorLeftSubText ?? "N/A"}
          </span>
        </div>
      </div>
      <div className="absolute top-[940px] left-[1135px] text-left">
        <div className="text-[36px]">{data?.commentatorRight ?? "N/A"}</div>
        <div className="mt-[-16px]">
          {/* <span>
            {data.commentatorRightSocialMedia === "twitter"
              ? twitter
              : data.commentatorRightSocialMedia === "youtube"
                ? youtube
                : ""}
          </span> */}
          <span className="text-[28px] ml-[10px]">
            {data?.commentatorRightSubText ?? "N/A"}
          </span>
        </div>
      </div>
    </div>
  );
}
